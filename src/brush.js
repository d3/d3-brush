import {dispatch} from "d3-dispatch";
import constant from "./constant";

var brushCursor = {
  n: "ns-resize",
  e: "ew-resize",
  s: "ns-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize"
};

var brushResizes = [
  ["n", "e", "s", "w", "nw", "ne", "se", "sw"],
  ["e", "w"],
  ["n", "s"],
  []
];

function defaultExtent() {
  var svg = this.ownerSVGElement;
  return [[0, 0], svg
      ? [svg.width.baseVal.value, svg.height.baseVal.value]
      : [this.clientWidth, this.clientHeight]];
}

export default function() {
  var extent = defaultExtent,
      listeners = dispatch(brush, "brushstart", "brush", "brushend"),
      resizes = brushResizes[0];

  // TODO tell the brush whether you can brush in x, y or x and y.
  // TODO the initial render of the brush assumes that the active region is empty
  function brush(selection) {
    selection
        .style("pointer-events", "all")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)")
        // .on("mousedown.brush", mousedowned) // TODO
        // .on("touchstart.brush", touchstarted); // TODO

    var background = selection.selectAll(".background")
      .data(function() { return [extent.apply(this, arguments)]; });

    background.enter().append("rect")
        .attr("class", "background")
        .style("visibility", "hidden")
        .style("cursor", "crosshair")
      .merge(background)
        .attr("x", function(d) { return d[0][0]; })
        .attr("y", function(d) { return d[0][1]; })
        .attr("width", function(d) { return d[1][0] - d[0][0]; })
        .attr("height", function(d) { return d[1][1] - d[0][1]; });

    selection.selectAll(".extent")
      .data(function() { return [null]; })
      .enter().append("rect")
        .attr("class", "extent")
        .style("cursor", "move")
        .style("display", "none");

    var resize = selection.selectAll(".resize")
      .data(resizes, String);

    resize.exit().remove();

    resize.enter().append("g")
        .attr("class", function(d) { return "resize resize--" + d; })
        .style("cursor", function(d) { return brushCursor[d]; })
        .style("display", "none")
      .append("rect")
        .attr("x", function(d) { return /[ew]$/.test(d) ? -3 : null; })
        .attr("y", function(d) { return /^[ns]/.test(d) ? -3 : null; })
        .attr("width", 6)
        .attr("height", 6)
        .style("visibility", "hidden");
  }

  brush.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), brush) : extent;
  };

  brush.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? brush : value;
  };

  return brush;
}
