var util = require('util');

function Builder(onVal, onEnd) {
    this.result = [];
    var self = this;
    this.onVal = onVal || function(v) { self.result.push(v); return self; };
    this.onEnd = onEnd || function(b) { return b; };
}

module.exports = Builder;

// Simple values
Builder.prototype.boolean = function(val) { return this.onVal(val); };
Builder.prototype.nullval = function() { return this.onVal(null); };
Builder.prototype.string = function(val) { return this.onVal(val); };
Builder.prototype.binary = function(val) { return this.onVal(val); };

Builder.prototype.symbol = function(val) {
    return this.onVal(['symbol', val]);
};

var ieee754_binary32_range = [ -1 * Math.pow(2, 126), (2 - Math.pow(2, -23)) * Math.pow(2, 127) ];

/**
 * Encode the given number to the given type.  If type not provided, it will be inferred.
 * Inference prefers unsigned, and smallest representation possible.
 *
 * @param {string} [type]   Type of the number (e.g. ulong).
 * @param {number} val      Value to encode.
 */
Builder.prototype.number = function(type, val) {
    if (val === undefined) {
        val = type;
        type = undefined;
    }

    if (type === undefined) {
        var isSigned = val < 0;
        var isInt = val % 1 === 0;
        var size;
        if (isInt) {
            if (isSigned) {
                var abs = Math.abs(val);
                if (abs > 0x7FFFFFFF) size = 8;
                else if (abs > 0x7FFF) size = 4;
                else if (abs > 0x7F) size = 2;
                else size = 1;
            } else {
                if (val > 0xFFFFFFFF) size = 8;
                else if (val > 0xFFFF) size = 4;
                else if (val > 0xFF) size = 2;
                else size = 1;
            }
        } else {
            if (val < ieee754_binary32_range[0] || val > ieee754_binary32_range[1]) size = 8;
            else size = 4;
        }

        if (isInt) {
            type = isSigned ? '' : 'u';
            switch(size) {
                case 1:
                    type += 'byte';
                    break;
                case 2:
                    type += 'short';
                    break;
                case 4:
                    type += 'int';
                    break;
                case 8:
                    type += 'long';
            }
        } else {
            if (size === 4) type = 'float';
            else type = 'double';
        }
    }

    return this.onVal([ type, val ]);
};

/**
 * Returns the encoded value built up by previous builder calls.  Does not reset value, allowing encode to be called multiple times.
 *
 * @returns {Array} The encoded value (e.g. ['ulong', 123]).
 */
Builder.prototype.encode = function() {
    return this.result.length === 1 ? this.result[0] : this.result;
};

Builder.prototype.end = function() {
    return this.onEnd(this);
};

/**
 * Resets the builder to allow re-use.
 */
Builder.prototype.reset = function() {
    this.result = [];
    return this;
};

function DescribedTypeBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.descriptor = undefined;
    this.value = undefined;
    var self = this;
    this.builder = new Builder(function (val) {
        if (self.descriptor === undefined) {
            self.descriptor = val;
            self.builder.reset();
            return self.builder;
        } else {
            self.value = val;
            return self.baseBuilder.onVal(['described', self.descriptor, self.value]);
        }
    });
}

Builder.prototype.described = function() {
    var dt = new DescribedTypeBuilder(this);
    return dt.builder;
};

function ListBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.encoded = ['list'];
    var self = this;
    this.builder = new Builder(function (val) {
        self.encoded.push(val);
        return self.builder;
    }, function(b) {
        return self.baseBuilder.onVal(self.encoded);
    });
}

Builder.prototype.list = function() {
    var l = new ListBuilder(this);
    return l.builder;
};

function MapBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.encoded = ['map'];
    var self = this;
    this.builder = new Builder(function (val) {
        self.encoded.push(val);
        return self.builder;
    }, function(b) {
        return self.baseBuilder.onVal(self.encoded);
    });
}

Builder.prototype.map = function() {
    var m = new MapBuilder(this);
    return m.builder;
};