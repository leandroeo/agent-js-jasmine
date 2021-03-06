const SpecificUtils = require('./specificUtils');

class ReportportalReporter {
    constructor(conf) {
        this.client = conf.client;
        this.tempLaunchId = conf.tempLaunchId;
        this.parentIds = [];
        this.conf = conf;
    }

    escapeMarkdown(string) {
        return string.replace(/_/gm, '\\_').replace(/\*/gm, '\\*');
    }

    getParentId() {
        if (!this.parentIds.length) {
            return null;
        }
        return this.parentIds[this.parentIds.length - 1];
    }

    setParentId(id) {
        this.parentIds.push(id);
    }

    finishParent() {
        this.parentIds.pop();
    }

    getTopLevelType() {
        if (!this.parentIds.length) {
            return 'SUITE';
        }
        return 'TEST';
    }

    jasmineStarted(info) {
    }

    suiteStarted(suite) {
        let type = this.getTopLevelType();
        let suiteObj = this.client.startTestItem({
            type,
            description: suite.description,
            name: suite.fullName
        }, this.tempLaunchId, this.getParentId());
        this.setParentId(suiteObj.tempId);
        suiteObj.promise
            .catch(error=>{
                console.log(new Error(error));
            })
    }

    specStarted(spec) {
        let stepObj = this.client.startTestItem({
            type: 'STEP',
            description: spec.description,
            name: spec.fullName
        }, this.tempLaunchId, this.getParentId());
        this.setParentId(stepObj.tempId);
        stepObj.promise
            .catch(error=>{
                console.log(new Error(error));
            })
    }

    specDone(spec) {
        let status = spec.status;
        if (status === "pending" || status === "disabled") {
            status = "skipped";
        }
        let level = '';
        let message = spec.fullName;
        if (status === 'failed') {
            level = 'ERROR';
            let failures = [];
            spec.failedExpectations.forEach((failure) => {
                failures.push(`message: ${this.escapeMarkdown(failure.message)}`);
                failures.push(`stackTrace: ${this.escapeMarkdown(failure.stack)}`);
            });
            message = failures.join('\n');
        }
        let parentId = this.getParentId();
        let promise = Promise.resolve(null);
        if (this.conf.attachPicturesToLogs) {
            promise = SpecificUtils.takeScreenshot(spec.fullName);
        }
        promise.then((fileObj) => {
            let sendLogPromise = this.client.sendLog(parentId, {
                message,
                level
            }, fileObj);
            sendLogPromise.promise
                .catch(error=>{
                    console.log(new Error(error));
                });
            let finishTestItemPromise = this.client.finishTestItem(parentId, {
                status
            });
            finishTestItemPromise.promise
                .catch(error=>{
                    console.log(new Error(error));
                });
        });

        this.finishParent();
    }

    suiteDone(suite) {
        let suiteDonePromise = this.client.finishTestItem(this.getParentId(), {});
        suiteDonePromise.promise
            .catch(error=>{
                console.log(new Error(error));
            });
        this.finishParent();
    }

    jasmineDone() {
    }
}

module.exports = ReportportalReporter;