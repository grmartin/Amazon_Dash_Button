/* DIGI-813 */
Coveo.Ui.QueryBox.prototype._handleQueryStateChanged = function (e, data) {
    Coveo.Assert.exists(data);
    var q = data.value;
    if (q != Coveo.$(this.element).val()) {
        Coveo.$(this.element).val(q);
    }
    this._addClearElement();
};
