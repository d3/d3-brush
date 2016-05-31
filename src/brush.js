import {dispatch} from "d3-dispatch";
import {customEvent} from "d3-selection";
import constant from "./constant";
import BrushEvent from "./event";

var N = {id: "n", cursor: "ns-resize"},
    E = {id: "e", cursor: "ew-resize"},
    S = {id: "s", cursor: "ns-resize"},
    W = {id: "w", cursor: "ew-resize"},
    NW = {id: "nw", cursor: "nwse-resize"},
    NE = {id: "ne", cursor: "nesw-resize"},
    SE = {id: "se", cursor: "nwse-resize"},
    SW = {id: "sw", cursor: "nesw-resize"},
    brushResizes = [[N, E, S, W, NW, NE, SE, SW], [E, W], [N, S], []];

function defaultExtent() {
  var svg = this.ownerSVGElement;
  return [[0, 0], svg
      ? [svg.width.baseVal.value, svg.height.baseVal.value]
      : [this.clientWidth, this.clientHeight]];
}

function resizeData(d) {
  return {
    id: d.id,
    cursor: d.cursor,
    extent: null
  };
}

export default function() {
  var extent = defaultExtent,
      listeners = dispatch(brush, "start", "brush", "end"),
      resizes = brushResizes[0];

  // TODO tell the brush whether you can brush in x, y or x and y.
  // TODO tell the brush whether to clamp the selection to the extent.
  // TODO the initial render of the brush assumes that the selected extent is empty
  // TODO how do you update the extent of the background?
  function brush(selection) {
    selection.selectAll(".background")
      .data(function() { return [extent.apply(this, arguments)]; })
      .enter().append("rect")
        .attr("class", "background")
        .attr("fill", "none")
        .attr("cursor", "crosshair");

    selection.selectAll(".extent")
      .data([null])
      .enter().append("rect")
        .attr("class", "extent")
        .attr("cursor", "move")
        .attr("fill", "rgba(0,0,0,0.15)");

    var resize = selection.selectAll(".resize")
      .data(resizes.map(resizeData), function(d) { return d.id; });

    resize.exit().remove();

    resize.enter().append("g")
        .attr("class", function(d) { return "resize resize--" + d.id; })
        .attr("cursor", function(d) { return d.cursor; })
      .append("rect")
        .attr("fill", "none");

    selection
        .call(redraw)
        .attr("pointer-events", "all")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)")
        // .on("mousedown.brush", mousedowned) // TODO
        // .on("touchstart.brush", touchstarted); // TODO
  }

  // TODO selection as transition
  brush.move = function(selection, selected) {
    selection
        .interrupt()
        .property("__brush", selected)
        .call(redraw)
        .call(emit, "start")
        .call(emit, "brush")
        .call(emit, "end");
  };

  function redraw(selection) {
    selection.select(".extent")
        .datum(function() { return this.parentNode.__brush; })
        .style("display", function(d) { return d == null ? "none" : null; })
      .filter(function(d) { return d != null; })
        .attr("x", function(d) { return d[0][0]; })
        .attr("y", function(d) { return d[0][1]; })
        .attr("width", function(d) { return d[1][0] - d[0][0]; })
        .attr("height", function(d) { return d[1][1] - d[0][1]; });

    selection.selectAll(".resize")
        .each(function(d) { d.extent = this.parentNode.__brush; })
        .style("display", function(d) { return d.extent == null ? "none" : null; })
      .filter(function(d) { return d.extent != null; })
        .attr("transform", function(d) { return "translate(" + d.extent[+/e$/.test(d.id)][0] + "," + d.extent[+/^s/.test(d.id)][1] + ")"; })
      .select("rect")
        .attr("width", function(d) { return /^(n|s)$/.test(d.id) ? d.extent[1][0] - d.extent[0][0] : 6; })
        .attr("height", function(d) { return /^(e|w)$/.test(d.id) ? d.extent[1][1] - d.extent[0][1] : 6; });
  }

  function emit(selection, type) {
    selection.each(function() {
      customEvent(new BrushEvent(brush, type, this.__brush), listeners.apply, listeners, [type, this, arguments]);
    });
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
