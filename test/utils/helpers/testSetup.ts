import util from "node:util";

// Increase the default depth of the inspect function to 6 (from the default of 2)
util.inspect.defaultOptions.depth = 6;
