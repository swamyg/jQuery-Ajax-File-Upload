define(['jquery', 'underscore', 'i18n'], function($, _, I18n) {
    var DEFAULT_ALLOWED_EXTENSION = '*.*';
    var defaults = {
        allowedExtensions: [DEFAULT_ALLOWED_EXTENSION],
        sizeLimit: null,
        endpointUrl: '/',
        beforeSubmit: function() {},
        onUpload: function() {},
        onProgress: function() {},
        onComplete: function() {},
        onError: function() {}
    };

    var AjaxFileUploader = function(options) {
        if (!options.element) {
            throw "An 'element' option is required for ajax file uploader to work";
        }
        this.$element = $(options.element);
        this.$fileInputField = this.$element.find('input[type=file]');
        this.settings = $.extend({}, defaults, options);
        this.file = null;
        this.errors = [];
        this.init();
    };

    AjaxFileUploader.prototype = {
        init: function() {
            this.$fileInputField.on('change', this.processUpload.bind(this));
            this.setupOnClick();
        },

        setupOnClick: function() {
            var self = this;
            this.$fileInputField.on('click', function(e) {
                e.stopPropagation();
            });
            this.$element.on('click', function() {
                self.$fileInputField.click();
            });
        },

        processUpload: function(e) {
            e.stopPropagation();
            e.preventDefault();

            this.processFile(e);
            this.checkForValidExtension();
            this.checkForValidSize();
            this.handleBeforeSubmit();
        },

        handleBeforeSubmit: function() {
            // Handle errors, if none then invoke beforeSubmit
            var self = this;
            if (this.errors.length > 0) {
                this.handleErrors();
            } else {
                var promise = this.settings.beforeSubmit();
                promise
                    .done(function() {
                        // once the promise has been resolved externally, proceed to upload the file
                        self.uploadFile();
                    })
                    .fail(function() {
                        // if the promise has been rejected externally, display an error.
                        self.errors.push(
                            I18n.gettext('We had a problem uploading your video. Please try again.')
                        );
                        self.handleErrors();
                    });
            }
        },

        processFile: function(e) {
            this.file = e.target.files[0];
        },

        checkForValidExtension: function() {
            if (this.settings.allowedExtensions[0] === DEFAULT_ALLOWED_EXTENSION) {
                return;
            }

            var extension = this.getFileExtension();
            if (!_.contains(this.settings.allowedExtensions, extension)) {
                this.errors.push(
                    I18n.gettext(
                        'We were unable to upload your video due to file type. ' +
                            'Please ensure your video is in MP4 format.'
                    )
                );
            }
        },

        checkForValidSize: function() {
            if (this.settings.sizeLimit === null) {
                return;
            }

            var fileName = this.file.name;
            var fileSize = this.file.size;
            if (fileSize > this.settings.sizeLimit) {
                this.errors.push(
                    I18n.interpolate(
                        I18n.gettext(
                            'We were unable to upload your video due to file size.' +
                                ' Please ensure the video is %(maxFileSize)s or less.'
                        ),
                        { fileName: fileName, maxFileSize: this.bytesToSize(this.settings.sizeLimit) },
                        true
                    )
                );
            }
        },

        bytesToSize: function(bytes) {
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            var index = 0;
            var precision = 2;
            if (bytes === 0) {
                return '0 KB';
            }
            while (bytes >= 1024) {
                index++;
                bytes = bytes / 1024;
            }
            return Number(parseFloat(bytes).toFixed(precision)) + ' ' + sizes[index];
        },

        handleAjaxProgress: function(progressEvent) {
            this.settings.onProgress(progressEvent.loaded, progressEvent.total);
        },

        handleAjaxResponse: function(respObj) {
            if (_.isEmpty(respObj) || respObj.status === 200) {
                this.settings.onComplete();
            } else if (respObj.statusText === 'abort') {
                return; // This happens when we cancel or abort the upload
            } else {
                var reason = I18n.gettext('We had a problem uploading your video. Please try again.');
                this.errors.push(reason);
                this.handleErrors();
            }
        },

        handleErrors: function() {
            this.settings.onError(this.errors);
            this.errors = [];
        },

        // Method called from outside to abort the ajax upload
        cancelUpload: function() {
            if (!this._xhr) {
                return;
            }
            this._xhr.abort();
        },

        // Method called from outside to set endpoint for ajax upload
        setEndpoint: function(url) {
            this.settings.endpointUrl = url;
        },

        getFileExtension: function() {
            return this.file !== null ? this.file.name.split('.').pop() : null;
        },

        uploadFile: function() {
            var self = this; // this = AjaxFileUploader instance
            var options = {
                url: this.settings.endpointUrl,
                type: 'PUT',
                contentType: 'multipart/form-data',
                processData: false,
                data: this.file,
                success: this.handleAjaxResponse.bind(this),
                error: this.handleAjaxResponse.bind(this),
                xhr: function() {
                    // get the native XmlHttpRequest object
                    var xhr = $.ajaxSettings.xhr();
                    // set the onprogress event handler
                    xhr.upload.onprogress = self.handleAjaxProgress.bind(self);

                    var setRequestHeader = xhr.setRequestHeader;
                    xhr.setRequestHeader = function(name, value) {
                        // Ignore the X-Requested-With and X-CSRFToken header
                        // TODO: S3 CORS should be configured to allow these headers
                        if (name === 'X-Requested-With') {
                            return;
                        }
                        if (name === 'X-CSRFToken') {
                            return;
                        }
                        setRequestHeader.call(this, name, value);
                    };
                    return xhr;
                }
            };
            this._xhr = $.ajax(options);
            this.settings.onUpload();
        }
    };

    return AjaxFileUploader;
});