import {test} from "vitest";
import assert from "assert";
import * as d3 from "../src/index.js";

test("brush methods", () => {
  assert.deepStrictEqual(Object.keys(d3).sort(), [
    "brush", "brushSelection", "brushX", "brushY"
  ]);
});	
