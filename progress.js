module.exports = class Progress {
    _started = false;
    constructor() {
    }
    getPercentage() {
        if (!this._started) {
            return 0;
        }
        return Math.round((this.zippedContent.length / this.contentFiles.length ) * 100);
    }
    isStarted(){
        return this._started;
    }
}