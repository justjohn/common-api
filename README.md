common-api
==========

Node API abstraction library.

## Usage

### Without API Key

```js
var MyAPI = function() {
    // api specific setup
};

MyAPI.prototype = new API({
    hostname: 'api.domain.com',
    format:   API.FORMAT.JSON,
    // prefix for all api reqeusts
    base:     '/v1'
});

MyAPI.prototype.getWidgets = function() {
    // this.call returns a promise.
    //
    // The constructed URL for this call would be:
    //     http://api.domain.com/v1/widgets
    //
    return this.call('widgets').then(function(widgets) {
        // do some transformations on the api response

        return widgets;
    };
};
```

### With API Key in URL

```js
var MyAPI = function(api_key) {
    // setup
    this.api_key = api_key;
};

MyAPI.prototype = new API({
    hostname: 'api.domain.com',
    // use https on port 443
    secure:   true,
    format:   API.FORMAT.JSON,
    base:     '/json/{api_key}',

    // urlTransform is called after building the request URL.
    urlTransform: function(url) { return url.replace('{api_key}', this.api_key); }
});
```
