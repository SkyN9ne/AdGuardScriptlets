import {
    hit,
    noopFunc,
    trueFunc,
    falseFunc,
    getPropertyInChain,
    setPropertyAccess,
    toRegExp,
    matchStackTrace,
} from '../helpers';

/* eslint-disable max-len */
/**
 * @scriptlet set-constant
 *
 * @description
 * Creates a constant property and assigns it one of the values from the predefined list.
 *
 * > Actually, it's not a constant. Please note, that it can be rewritten with a value of a different type.
 *
 * Related UBO scriptlet:
 * https://github.com/gorhill/uBlock/wiki/Resources-Library#set-constantjs-
 *
 * **Syntax**
 * ```
 * example.org#%#//scriptlet('set-constant', property, value)
 * ```
 *
 * - `property` - required, path to a property (joined with `.` if needed). The property must be attached to `window`.
 * - `value` - required. Possible values:
 *     - positive decimal integer `<= 32767`
 *     - one of the predefined constants:
 *         - `undefined`
 *         - `false`
 *         - `true`
 *         - `null`
 *         - `noopFunc` - function with empty body
 *         - `trueFunc` - function returning true
 *         - `falseFunc` - function returning false
 *         - `''` - empty string
 *         - `-1` - number value `-1`
 * - `stack` - optional, string or regular expression that matches the file to limit scriptlet applying
 *
 * **Examples**
 * ```
 * ! window.firstConst === false // this comparision will return false
 * example.org#%#//scriptlet('set-constant', 'firstConst', 'false')
 *
 * ! window.second() === trueFunc // 'second' call will return true
 * example.org#%#//scriptlet('set-constant', 'secondConst', 'trueFunc')
 *
 * ! document.third() === falseFunc  // 'third' call will return false if the method is related to checking.js
 * example.org#%#//scriptlet('set-constant', 'secondConst', 'trueFunc', 'checking.js')
 * ```
 */
/* eslint-enable max-len */
export function setConstant(source, property, value, stack) {
    const stackRegexp = stack ? toRegExp(stack) : toRegExp('/.?/');
    if (!property
        || !matchStackTrace(stackRegexp, new Error().stack)) {
        return;
    }

    const nativeIsNaN = Number.isNaN || window.isNaN; // eslint-disable-line compat/compat

    let constantValue;
    if (value === 'undefined') {
        constantValue = undefined;
    } else if (value === 'false') {
        constantValue = false;
    } else if (value === 'true') {
        constantValue = true;
    } else if (value === 'null') {
        constantValue = null;
    } else if (value === 'noopFunc') {
        constantValue = noopFunc;
    } else if (value === 'trueFunc') {
        constantValue = trueFunc;
    } else if (value === 'falseFunc') {
        constantValue = falseFunc;
    } else if (/^\d+$/.test(value)) {
        constantValue = parseFloat(value);
        if (nativeIsNaN(constantValue)) {
            return;
        }
        if (Math.abs(constantValue) > 0x7FFF) {
            return;
        }
    } else if (value === '-1') {
        constantValue = -1;
    } else if (value === '') {
        constantValue = '';
    } else {
        return;
    }

    let canceled = false;
    const mustCancel = (value) => {
        if (canceled) {
            return canceled;
        }
        canceled = value !== undefined
            && constantValue !== undefined
            && typeof value !== typeof constantValue;
        return canceled;
    };

    const setChainPropAccess = (owner, property) => {
        const chainInfo = getPropertyInChain(owner, property)[0];
        let { base } = chainInfo;
        const { prop, chain } = chainInfo;
        if (chain) {
            const setter = (a) => {
                base = a;
                if (a instanceof Object) {
                    setChainPropAccess(a, chain);
                }
            };
            Object.defineProperty(owner, prop, {
                get: () => base,
                set: setter,
            });
            return;
        }

        if (mustCancel(base[prop])) { return; }

        hit(source);
        setPropertyAccess(base, prop, {
            get: () => constantValue,
            set: (a) => {
                if (mustCancel(a)) {
                    constantValue = a;
                }
            },
        });
    };

    setChainPropAccess(window, property);
}

setConstant.names = [
    'set-constant',
    'set-constant.js',
    'ubo-set-constant.js',
    'set.js',
    'ubo-set.js',
];
setConstant.injections = [
    getPropertyInChain,
    setPropertyAccess,
    toRegExp,
    matchStackTrace,
    hit,
    noopFunc,
    trueFunc,
    falseFunc,
];
