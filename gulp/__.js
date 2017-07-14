// only a utility function to decorate gulp tasks with a description which are then
// also visible when running 'gulp --tasks'
module.exports = function __(description, fn) {
    fn.description = description;
    return fn;
};