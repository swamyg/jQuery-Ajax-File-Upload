define(['underscore', 'jquery', 'content/jquery_ajax_file_uploader'], function(_, $, AjaxFileUploader) {
    describe('AjaxFileUploader', function() {
        beforeEach(function() {
            this.element = $(
                '<div id="ajax-uploader"> <div class="ui-icon"></div> ' +
                    '<span class="cta-label text-muted">Add Video</span>' +
                    '<input type="file" class="video-upload-file-input" name="video_upload"> </div>'
            );
        });

        describe('Without an element option passed', function() {
            it('throws an exception', function() {
                expect(function() {
                    new AjaxFileUploader({});
                }).toThrow("An 'element' option is required for ajax file uploader to work");
            });
        });

        describe('file validations', function() {
            beforeEach(function() {
                this.file = { name: 'bunny_video.avi', size: 2024 * 2024 * 2024 };
                this.ajaxUploader = new AjaxFileUploader({
                    element: this.element,
                    allowedExtensions: ['mp4'],
                    sizeLimit: 1024 * 1024 * 1024
                });
                this.ajaxUploader.file = this.file;
            });

            it('should have an error in errors array when checking for valid extension', function() {
                this.ajaxUploader.checkForValidExtension();
                expect(this.ajaxUploader.errors[0]).toEqual(
                    'We were unable to upload your video due to file type. ' +
                        'Please ensure your video is in MP4 format.'
                );
            });

            it('should have an error in errors array when checking for valid size', function() {
                this.ajaxUploader.checkForValidSize();
                expect(this.ajaxUploader.errors[0]).toEqual(
                    'We were unable to upload your video due to file size. ' +
                        'Please ensure the video is 1 GB or less.'
                );
            });
        });

        describe('bytesToSize', function() {
            beforeEach(function() {
                this.ajaxUploader = new AjaxFileUploader({ element: this.element });
            });

            it('returns 1.00 KB for input of 1024', function() {
                expect(this.ajaxUploader.bytesToSize(1024)).toEqual('1 KB');
            });

            it('returns 1.00 MB for input of 1024*1024', function() {
                expect(this.ajaxUploader.bytesToSize(1024 * 1024)).toEqual('1 MB');
            });

            it('returns 2.59 GB for input of 2*1324*1024*1024', function() {
                expect(this.ajaxUploader.bytesToSize(2 * 1324 * 1024 * 1024)).toEqual('2.59 GB');
            });

            it('returns O KB for input of 0', function() {
                expect(this.ajaxUploader.bytesToSize(0)).toEqual('0 KB');
            });
        });

        describe('handle before submit', function() {
            beforeEach(function() {
                var self = this;
                this.beforeSubmitDeferred = $.Deferred();
                this.beforeSubmitPromise = this.beforeSubmitDeferred.promise();
                this.beforeSubmitCallback = jest.fn(function() {
                    return self.beforeSubmitPromise;
                });
                this.ajaxUploader = new AjaxFileUploader({
                    element: this.element,
                    beforeSubmit: this.beforeSubmitCallback
                });
            });

            it('calls before submit callback', function() {
                this.ajaxUploader.handleBeforeSubmit();
                expect(this.beforeSubmitCallback).toHaveBeenCalled();
            });

            it('calls uploadFile when deferred is externally resolved', function() {
                spyOn(this.ajaxUploader, 'uploadFile');
                this.ajaxUploader.handleBeforeSubmit();
                this.beforeSubmitDeferred.resolve();
                expect(this.ajaxUploader.uploadFile).toHaveBeenCalled();
            });

            it('handles errors when deferred is rejected externally', function() {
                spyOn(this.ajaxUploader, 'handleErrors');
                this.ajaxUploader.handleBeforeSubmit();
                this.beforeSubmitDeferred.reject();
                expect(this.ajaxUploader.handleErrors).toHaveBeenCalled();
                expect(this.ajaxUploader.errors[0]).toEqual(
                    'We had a problem uploading your video. Please try again.'
                );
            });
        });

        describe('Upload Callbacks', function() {
            beforeEach(function() {
                this.onCompleteCallback = jasmine.createSpy();
                this.onErrorCallback = jasmine.createSpy();
                this.onUploadCallback = jasmine.createSpy();
                this.ajaxUploader = new AjaxFileUploader({
                    element: this.element,
                    onComplete: this.onCompleteCallback,
                    onError: this.onErrorCallback,
                    onUpload: this.onUploadCallback
                });
            });

            it('calls onComplete callback if ajax call returns success', function() {
                $.ajax = jest.fn(function(options) {
                    options.success({ status: 200 });
                });

                this.ajaxUploader.uploadFile();
                expect(this.onCompleteCallback).toHaveBeenCalled();
            });

            it('calls onError callback if ajax call returns an error', function() {
                $.ajax = jest.fn(function(options) {
                    options.error({ status: 403 });
                });

                this.ajaxUploader.uploadFile();
                expect(this.onErrorCallback).toHaveBeenCalled();
            });

            it('calls onUpload callback if ajax call returns an error', function() {
                $.ajax = jest.fn(function(options) {
                    options.success({ status: 200 });
                });

                this.ajaxUploader.uploadFile();
                expect(this.onUploadCallback).toHaveBeenCalled();
            });
        });
    });
});