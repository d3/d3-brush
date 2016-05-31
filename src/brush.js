import {dispatch} from "d3-dispatch";
import {customEvent} from "d3-selection";
import constant from "./constant";
import BrushEvent from "./event";

var N = "n", E = "e", S = "s", W = "w", NW = "nw", NE = "ne", SE = "se", SW = "sw",
    brushResizes = [[N, E, S, W, NW, NE, SE, SW], [E, W], [N, S], []],
    brushCursors = {n: "ns", e: "ew", s: "ns", w: "ew", nw: "nwse", ne: "nesw", se: "nwse", sw: "nesw"};

function defaultExtent() {
  var svg = this.ownerSVGElement;
  return [[0, 0], svg
      ? [svg.width.baseVal.value, svg.height.baseVal.value]
      : [this.clientWidth, this.clientHeight]];
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
    var background = selection
        .property("__brush", initialLocal)
      .selectAll(".background")
      .data([{type: "background"}]);

    background.enter().append("rect")
        .attr("class", "background")
        .attr("fill", "none")
        .attr("cursor", "crosshair")
      .merge(background)
        .attr("x", function() { var l = local(this); return l.extent[0][0]; })
        .attr("y", function() { var l = local(this); return l.extent[0][1]; })
        .attr("width", function() { var l = local(this); return l.extent[1][0] - l.extent[0][0]; })
        .attr("height", function() { var l = local(this); return l.extent[1][1] - l.extent[0][1]; });

    selection.selectAll(".selection")
      .data([{type: "selection"}])
      .enter().append("rect")
        .attr("class", "selection")
        .attr("cursor", "move")
        .attr("fill", "rgba(0,0,0,0.15)");

    var resize = selection.selectAll(".resize")
      .data(resizes.map(function(t) { return {type: t}; }), function(d) { return d.type; });

    resize.exit().remove();

    resize.enter().append("rect")
        .attr("class", function(d) { return "resize resize--" + d.type; })
        .attr("cursor", function(d) { return brushCursors[d.type] + "-resize"; })
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
        .each(typeof selected === "function"
            ? function() { this.__brush.selected = selected.apply(this, arguments); }
            : function() { this.__brush.selected = selected; })
        .call(redraw)
        .call(emit, "start")
        .call(emit, "brush")
        .call(emit, "end");
  };

  function redraw(selection) {
    selection.selectAll(".selection")
        .style("display", function() { var l = local(this); return l.selected == null ? "none" : null; })
      .filter(function() { var l = local(this); return l.selected != null; })
        .attr("x", function() { var l = local(this); return l.selected[0][0]; })
        .attr("y", function() { var l = local(this); return l.selected[0][1]; })
        .attr("width", function() { var l = local(this); return l.selected[1][0] - l.selected[0][0]; })
        .attr("height", function() { var l = local(this); return l.selected[1][1] - l.selected[0][1]; });

    selection.selectAll(".resize")
        .style("display", function() { var l = local(this); return l.selected == null ? "none" : null; })
      .filter(function() { var l = local(this); return l.selected != null; })
        .attr("x", function(d) { var l = local(this); return d.type[d.type.length - 1] === "e" ? l.selected[1][0] - 3 : l.selected[0][0] - 3; })
        .attr("y", function(d) { var l = local(this); return d.type[0] === "s" ? l.selected[1][1] - 3 : l.selected[0][1] - 3; })
        .attr("width", function(d) { var l = local(this); return d.type === "n" || d.type === "s" ? l.selected[1][0] - l.selected[0][0] + 6 : 6; })
        .attr("height", function(d) { var l = local(this); return d.type === "e" || d.type === "w" ? l.selected[1][1] - l.selected[0][1] + 6 : 6; });
  }

  function emit(selection, type) {
    selection.each(function() {
      customEvent(new BrushEvent(brush, type, this.__brush), listeners.apply, listeners, [type, this, arguments]);
    });
  }

  function initialLocal() {
    var local = this.__brush || {selected: null};
    local.extent = extent.apply(this, arguments);
    return local;
  }

  // Like d3.local, but with the name “__brush” rather than auto-generated.
  function local(node) {
    while (!node.__brush) if (!(node = node.parentNode)) return;
    return node.__brush;
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
