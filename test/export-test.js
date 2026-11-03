import assert from "node:assert";
import {it} from "vitest";
import * as d3 from "d3-brush";

it("brush methods", () => {
  assert.deepStrictEqual(Object.keys(d3).sort(), [
    "brush", "brushSelection", "brushX", "brushY"
  ]);
});
