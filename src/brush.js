import {dispatch} from "d3-dispatch";
import {dragDisable, dragEnable} from "d3-drag";
import {customEvent, mouse, select} from "d3-selection";
import constant from "./constant";
import BrushEvent from "./event";

var N = "n", E = "e", S = "s", W = "w", NW = "nw", NE = "ne", SE = "se", SW = "sw",
    // resizesX = [E, W],
    // resizesY = [N, S],
    resizesXY = [N, E, S, W, NW, NE, SE, SW];

var cursors = {
  background: "crosshair",
  selection: "move",
  n: "ns-resize",
  e: "ew-resize",
  s: "ns-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize"
};

function defaultExtent() {
  var svg = this.ownerSVGElement;
  return [[0, 0], svg
      ? [svg.width.baseVal.value, svg.height.baseVal.value]
      : [this.clientWidth, this.clientHeight]];
}

export default function() {
  var extent = defaultExtent,
      listeners = dispatch(brush, "start", "brush", "end"),
      resizes = resizesXY;

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
        .attr("pointer-events", "all")
        .attr("cursor", cursors.background)
      .merge(background)
        .attr("x", function() { var l = local(this); return l.extent[0][0]; })
        .attr("y", function() { var l = local(this); return l.extent[0][1]; })
        .attr("width", function() { var l = local(this); return l.extent[1][0] - l.extent[0][0]; })
        .attr("height", function() { var l = local(this); return l.extent[1][1] - l.extent[0][1]; });

    selection.selectAll(".selection")
      .data([{type: "selection"}])
      .enter().append("rect")
        .attr("class", "selection")
        .attr("cursor", cursors.selection)
        .attr("fill", "rgba(0,0,0,0.15)");

    var resize = selection.selectAll(".resize")
      .data(resizes.map(function(t) { return {type: t}; }), function(d) { return d.type; });

    resize.exit().remove();

    resize.enter().append("rect")
        .attr("class", function(d) { return "resize resize--" + d.type; })
        .attr("cursor", function(d) { return cursors[d.type]; })
        .attr("fill", "none");

    selection
        .call(redraw)
        .attr("pointer-events", "all")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)")
        .on("mousedown.brush", mousedowned);
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

  function mousedowned() {
    var that = this,
        selection = select(that),
        data = event.target.__data__,
        type = data.type,
        l = local(that),
        // center,
        // offset,
        origin = mouse(that);

    console.log("mousedown");

    select(event.view)
        .on("keydown.brush", keydowned, true)
        .on("keyup.brush", keyupped, true)
        .on("mousemove.brush", mousemoved, true)
        .on("mouseup.brush", mouseupped, true);

    dragDisable(event.view);
    selection.interrupt().selectAll("*").interrupt();
    selection.selectAll(".background").attr("cursor", cursors[type]);
    selection.attr("pointer-events", "none");

    switch (type) {
      case "selection": {
        origin[0] = l.selected[0][0] - origin[0];
        origin[1] = l.selected[0][1] - origin[1];
        break;
      }

      case "n":
      case "e":
      case "s":
      case "w":
      case "nw":
      case "ne":
      case "se":
      case "sw": {
        var i = type[type.length - 1] === "w", j = type[0] === "n";
        // offset = [l.selected[1 - i][0] - origin[0], l.selected[1 - j][1] - origin[1]];
        origin[0] = l.selected[+i][0];
        origin[1] = l.selected[+j][1];
        break;
      }

      // If the ALT key is down when starting a brush, center at the mouse.
      case "background": {
        // if (event.altKey) center = origin.slice();
        break;
      }
    }

    function mousemoved() {
      console.log("mousemove", type);
    }

    function mouseupped() {
      console.log("mouseup");
      dragEnable(event.view);
      selection.selectAll(".background").attr("cursor", cursors.background);
      selection.attr("pointer-events", "all");
      select(event.view).on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
    }

    function keydowned() {
      if (event.keyCode == 32) {
        if (type !== "selection") {
          // center = null;
          // origin[0] -= l.selected[1][0];
          // origin[1] -= l.selected[1][1];
          type = "space";
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function keyupped() {
      if (event.keyCode == 32) {
        if (type === "space") {
          // origin[0] += l.selected[1][0];
          // origin[1] += l.selected[1][1];
          type = data.type;
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }
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
