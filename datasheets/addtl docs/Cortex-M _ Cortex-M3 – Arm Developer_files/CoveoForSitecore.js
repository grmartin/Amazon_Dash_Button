CoveoForSitecore.defaults = {
    analyticsCustomMetadata: {},
    analyticsEndpointUri: '/coveo/rest/v6/analytics/',
    boostExpressions: '',
    clientLanguageFieldName: '',
    clientLanguageName: '',
    componentRefreshCallback: null,
    defaultSortType: 'Relevancy',
    defaultSortField: '',
    defaultSortCriteriaNoSpace: 'Relevancy',
    defaultSortCriteriaLowercase: 'relevancy',
    enableClientSideLogging: false,
    externalCollections: new Array(),
    externalSources: new Array(),
    filterResultOnLatestVersion: true,
    filterResultsOnCurrentCulture: false,
    hiddenExpression: '',
    indexSourceName: '',
    isEditingInPageEditor: false,
    isInitialized: false,
    isPreviewingInPageEditor: false,
    isPreviewingInPageEditorWithSimulatedDevice: false,
    latestVersionFieldName: '',
    pageFullPath: '',
    pageName: '',
    restEndpointUri: '/coveo/rest/',
    resultListInfiniteScrollContainer: Coveo.$(window),
    searchBoxPlaceholderText: '',
    searchRedirectionUrl: '',
    sendToSitecoreAnalytics: false,
    sitecoreItemId: '',
    sitecoreItemUri: '',
    siteName: ''
};

// This public variable is used by the Coveo search components to set the options before the initialization.
CoveoForSitecore.componentsOptions;

function CoveoForSitecore(element, options) {
    this.element = element;
    this.options = Coveo.$.extend({}, CoveoForSitecore.defaults, options);
}

(function () {
    var isInPageEditorCssClass = 'coveo-page-editor';
    var isEditingInPageEditorCssClass = 'coveo-page-editor-editing';
    var isPreviewingInPageEditorCssClass = 'coveo-page-editor-previewing';
    var isPreviewingInPageEditorWithSimulatedDeviceCssClass = 'coveo-page-editor-previewing-with-simulator';

    // We need this global reference when the events are raised by the JS UI
    // or when the loading callback is called.
    CoveoForSitecore.plugin;

    CoveoForSitecore.prototype.initializeSearchBox = function () {
        this.log('Initializing search box.');

        this.initializeSearchOptions();

        if (!this.options.isInitialized) {
            this.element.on(Coveo.Events.QueryEvents.buildingQuery, function (e, args) {
                var hiddenExpression = CoveoForSitecore.plugin.getHiddenExpression(CoveoForSitecore.plugin.options.indexSourceName,
                                                                                   CoveoForSitecore.plugin.options.hiddenExpression,
                                                                                   CoveoForSitecore.plugin.options.boostExpressions);

                args.queryBuilder.constantExpression.add(hiddenExpression);
            });
        }

        this.element.coveo('initSearchBox', this.options.searchRedirectionUrl, this.options);

        this.doPostInitializationActions();
    };

    CoveoForSitecore.prototype.initializeSearch = function () {
        this.log('Initializing search.');

        this.initializeSearchOptions();

        if (!this.options.isInitialized) {
            this.addPageEditorCssClasses();
            this.addResultListHeaderCssClasses();

            this.element.on(Coveo.Events.InitializationEvents.afterInitialization, function () {
                if (!Coveo.HashUtils.getValue('sort', window.location.hash)) {
                    Coveo.$('#search').coveo('state', 'sort', CoveoForSitecore.plugin.options.defaultSortCriteriaLowercase);
                }
            });

            var hiddenExpression = this.getHiddenExpression(this.options.indexSourceName,
                                                            this.options.hiddenExpression,
                                                            this.options.boostExpressions);

            // Merge the options we need to add with the options that are already set.
            var mergedOptions = Coveo.$.extend(true, {}, {
                ResultList: {
                    infiniteScrollContainer: this.options.resultListInfiniteScrollContainer
                },
                SearchInterface: {
                    hiddenExpression: hiddenExpression
                }
            }, this.options);

            this.element.coveo('init', mergedOptions);
        }

        this.doPostInitializationActions();
    };

    CoveoForSitecore.prototype.addSortCriteriaToQuery = function(queryBuilder) {
        queryBuilder.sortCriteria = this.options.defaultSortCriteriaNoSpace;
        if (this.options.defaultSortType === "Field") {
            queryBuilder.sortField = this.options.defaultSortField;
        }
    };

    CoveoForSitecore.prototype.initializeSearchOptions = function () {
        // We pass the "sitecoreItemUri" to the REST endpoint so it has the right context.
        // This is mandatory to make sure the Search Provider targets the right search index.
        Coveo.Rest.SearchEndpoint.endpoints['default'] = new Coveo.Rest.SearchEndpoint({
            restUri: this.options.restEndpointUri,
            queryStringArguments: { 'sitecoreItemUri': this.options.sitecoreItemUri, 'siteName': this.options.siteName }
        });

        if (this.options.enableClientSideLogging) {
            Coveo.Logger.enable();
        }

        if (!this.options.isInitialized) {
            this.addPageEditorCssClasses();

            this.element.on(Coveo.Events.QueryEvents.buildingQuery, function (e, args) {
                CoveoForSitecore.plugin.addSortCriteriaToQuery(args.queryBuilder);
            });

            this.element.on(Coveo.Events.InitializationEvents.afterInitialization, function() {
                // In this scope, "this" is the HTML element, not the plugin instance.
                CoveoForSitecore.plugin.registerSearchEvents();
            });

            if (this.options.sendToSitecoreAnalytics) {
                // Make sure to flush Analytics events on document clicks.
                window.onbeforeunload = function () {
                    Coveo.Defer.flush();
                }

                this.element.on(Coveo.Events.AnalyticsEvents.searchEvent, function (e, args) {
                    CoveoForSitecore.plugin.postAnalytics('searches', 'searchEvents', args.searchEvents);
                })
                .on(Coveo.Events.AnalyticsEvents.documentViewEvent, function (e, args) {
                    CoveoForSitecore.plugin.postAnalytics('documentViews', 'documentViewEvents', args.documentViewEvent);
                })
                .on(Coveo.Events.AnalyticsEvents.customEvent, function (e, args) {
                    CoveoForSitecore.plugin.postAnalytics('custom', 'customEvents', args.customEvent);
                });
            }
        }
    };

    CoveoForSitecore.prototype.doPostInitializationActions = function() {
        this.element.find("input.CoveoQueryBox").attr("placeholder", this.options.searchBoxPlaceholderText);

        this.options.isInitialized = true;
    };

    CoveoForSitecore.prototype.registerSearchEvents = function () {
        this.log('Registering search events');

        this.element.on(Coveo.Events.QueryEvents.buildingQuery, function (e, args) {
            // In this scope, "this" is the HTML element, not the plugin instance.
            args.queryBuilder.constantExpression.add(CoveoForSitecore.plugin.getFilterExpressions());
        })
        .on(Coveo.Events.AnalyticsEvents.changeAnalyticsCustomData, function (e, args) {
            var options = CoveoForSitecore.plugin.options;
            if (options) {
                if (options.clientLanguageName !== "") {
                    args.language = options.clientLanguageName;
                }
                if (options.siteName !== "") {
                    args.originLevel1 = options.siteName;
                }
                if (options.pageName !== "") {
                    args.originLevel2 = options.pageName;
                }
                if (options.pageFullPath !== "") {
                    args.originLevel3 = options.pageFullPath;
                }
                if (options.analyticsCustomMetadata) {
                    args.metaObject.metaDataAsString = Coveo.$.extend({}, args.metaObject.metaDataAsString, options.analyticsCustomMetadata);
                }
            }
        });

        if (this.options.componentRefreshCallback) {
            this.element.on(Coveo.Events.QueryEvents.deferredQuerySuccess, function () {
                CoveoForSitecore.plugin.options.componentRefreshCallback();
            })
            .on(Coveo.Events.QueryEvents.queryFailure, function () {
                CoveoForSitecore.plugin.options.componentRefreshCallback();
            });
        }
    };

    CoveoForSitecore.prototype.appendExternalContentToExpression = function (expression) {
        if (this.hasExternalContentSpecified()) {
            expression = '(' + expression;

            if (this.options.externalSources.length > 0) {
                var externalSourcesExpression = ' OR @syssource==("';
                externalSourcesExpression += this.options.externalSources.join('","');
                externalSourcesExpression += '")';

                expression += externalSourcesExpression;
            }

            if (this.options.externalCollections.length > 0) {
                var externalCollectionsExpression = ' OR @syscollection==("';
                externalCollectionsExpression += this.options.externalCollections.join('","');
                externalCollectionsExpression += '")';

                expression += externalCollectionsExpression;
            }

            expression += ')';
        }

        return expression;
    };

    CoveoForSitecore.prototype.getFilterExpressions = function () {
        var resultingExpression = '';
        var filterExpressions = new Array();

        if (CoveoForSitecore.plugin.options.filterResultsOnCurrentCulture) {
            var filterExpression = CoveoForSitecore.plugin.getFilterExpression(CoveoForSitecore.plugin.options.clientLanguageFieldName,
                                                                               CoveoForSitecore.plugin.options.clientLanguageName);
            filterExpressions.push(filterExpression);
        }
        if (CoveoForSitecore.plugin.options.filterResultOnLatestVersion) {
            var filterExpression = CoveoForSitecore.plugin.getFilterExpression(CoveoForSitecore.plugin.options.latestVersionFieldName,
                                                                               '1');
            filterExpressions.push(filterExpression);
        }

        if (filterExpressions.length > 0) {
            resultingExpression = '(';
            for (var i = 0; i < filterExpressions.length; i++) {
                resultingExpression += filterExpressions[i] + ' ';
            }

            resultingExpression = resultingExpression.replace(/^\s+|\s+$/g, '');
            resultingExpression += ')';
        }

        if (CoveoForSitecore.plugin.hasExternalContentSpecified()) {
            resultingExpression = CoveoForSitecore.plugin.appendExternalContentToExpression(resultingExpression);
        }

        return resultingExpression;
    };

    CoveoForSitecore.prototype.getFilterExpression = function (fieldName, fieldValue) {
        var expression = fieldName + '=="' + fieldValue + '"';

        return expression;
    };

    CoveoForSitecore.prototype.getHiddenExpression = function (indexSourceName, hiddenExpression, boostExpressions) {
        var result = '(';
        result += this.getSourcesExpression(indexSourceName);

        result += hiddenExpression;
        result += boostExpressions;
        result += ')';

        result = CoveoForSitecore.plugin.appendExternalContentToExpression(result);

        if (this.hasExternalContentSpecified()) {
            result += hiddenExpression;
            result += boostExpressions;
        }

        return result;
    };

    CoveoForSitecore.prototype.getSourcesExpression = function (indexSourceName) {
        var expression = '@syssource==(';
        if (typeof indexSourceName !== 'undefined') {
            expression += '"' + indexSourceName + '"';
        }
        expression += ')';

        return expression;
    };

    CoveoForSitecore.prototype.addPageEditorCssClasses = function () {
        if (this.isInPageEditor()) {
            this.element.addClass(isInPageEditorCssClass);

            if (this.options.isEditingInPageEditor) {
                this.element.addClass(isEditingInPageEditorCssClass);
            }
            if (this.options.isPreviewingInPageEditor) {
                this.element.addClass(isPreviewingInPageEditorCssClass);
            }
            if (this.options.isPreviewingInPageEditorWithSimulatedDevice) {
                this.element.addClass(isPreviewingInPageEditorWithSimulatedDeviceCssClass);
            }
        }
    };

    CoveoForSitecore.prototype.addResultListHeaderCssClasses = function () {
        // Both the mobile and full search interface does not use the
        // same CSS class for the result list header.
        Coveo.$('.coveo-results-header, .coveo-result-header-section').not(':has(.CoveoQuerySummary), :has(.CoveoQueryDuration), :has(.CoveoSort)').addClass('coveo-empty');
    };

    CoveoForSitecore.prototype.hasExternalContentSpecified = function () {
        return this.options.externalCollections.length > 0 || this.options.externalSources.length > 0;
    };

    CoveoForSitecore.prototype.isInPageEditor = function () {
        return this.options.isEditingInPageEditor ||
               this.options.isPreviewingInPageEditor ||
               this.options.isPreviewingInPageEditorWithSimulatedDevice;
    };

    CoveoForSitecore.prototype.log = function (message) {
        if (this.options.enableClientSideLogging) {
            console.log(['TRACE', 'Coveo for Sitecore'].concat(message));
        }
    };

    CoveoForSitecore.prototype.postAnalytics = function (eventAction, eventType, eventData) {
        eventData = [].concat(eventData);
        eventData.forEach(function (data) {
            data.sitecoreItemId = CoveoForSitecore.plugin.options.sitecoreItemId;
        });

        var postData = {};
        postData[eventType] = JSON.stringify(eventData);
        Coveo.$.post(this.appendTrailingSlash(this.options.analyticsEndpointUri) + eventAction, postData);
    };

    CoveoForSitecore.prototype.appendTrailingSlash = function (url) {
        return url.charAt(url.length - 1) === '/' ? url : url + '/';
    };

    CoveoForSitecore.prototype.onOmniboxRowClicked = function (result) {
        window.location.href = result.clickUri;
    };

    CoveoForSitecore.prototype.buildOmniBoxContent = function (results, options) {
        var _this = this;
        var template = new Coveo.Ui.UnderscoreTemplate(Coveo.$('#' + options.uniqueId).get(0));
        var content = Coveo.$('<div></div>');
        content.append(
            '<div class="coveo-omnibox-result-list-header"> \
                 <span class="coveo-icon-omnibox-result-list"></span> \
                 <span class="coveo-caption"></span> \
             </div>'
        );
        content.find('.coveo-caption').text(options.headerTitle);
        Coveo.$.each(results, function(i, result) {
            var oneRowOfContent = template.instantiateToElement(result);
            Coveo.$(oneRowOfContent).addClass('CoveoResult coveo-omnibox-selectable');

            Coveo.$(oneRowOfContent).on('click keyboardSelect', function () {
                _this.onOmniboxRowClicked(result);
            });
            content.append(oneRowOfContent);
        });
        return content;
    };

    CoveoForSitecore.prototype.populateOmniboxResultList = function(e, populateOmniBoxObject, options) {
        var wordToSearch = populateOmniBoxObject.completeQueryExpression.word;

        var deferred = Coveo.$.Deferred();
        populateOmniBoxObject.rows.push({ deferred: deferred });

        var queryBuilder = e.currentTarget.CoveoSearchInterface.queryController.createQueryBuilder(CoveoForSitecore.plugin.options);
        if (wordToSearch !== '') {
            queryBuilder.expression.add(wordToSearch);
        }
        queryBuilder.advancedExpression.add(CoveoForSitecore.plugin.getFilterExpressions());
        if (options.queryExpression && typeof (options.queryExpression) === 'string') {
            queryBuilder.advancedExpression.add(options.queryExpression);
        }
        queryBuilder.numberOfResults = options.numberOfResults;
        CoveoForSitecore.plugin.addSortCriteriaToQuery(queryBuilder);

        var query = queryBuilder.build();

        Coveo.Rest.SearchEndpoint.endpoints['default'].search(query).done(function(response) {
            if (response.queryError) {
                this.log(response.message);
            } else {
                var elementToReturn = CoveoForSitecore.plugin.buildOmniBoxContent(response.results, options);
                var objectToReturn = {
                    zIndex: options.omniboxDataRowIndex,
                    element: elementToReturn
                }
                deferred.resolve(objectToReturn);
            }
        });
    };

    CoveoForSitecore.prototype.configureOmnibox = function (options) {
        this.element.on(Coveo.Events.OmniBoxEvents.populateOmniBox,
                        function onPopulateOmniBox(e, populateOmniBoxObject) {
                            CoveoForSitecore.plugin.populateOmniboxResultList(e, populateOmniBoxObject, options);
                        }
        );
    };

    Coveo.$.fn.coveoForSitecore = function (action, options) {
        if (!CoveoForSitecore.plugin) {
            CoveoForSitecore.plugin = new CoveoForSitecore(this, options);
        }

        if (action === 'init') {
            CoveoForSitecore.plugin.initializeSearch();
        } else if (action === 'initSearchBox') {
            CoveoForSitecore.plugin.initializeSearchBox();
        } else {
            console.error('The action \'' + action + '\' is not part of the coveoForSitecore plugin. Ignoring action.');
        }

        return this;
    };
}());
