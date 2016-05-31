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
  // TODO tell the brush whether to clamp the selection to the extent?
  function brush(group) {
    var background = group
        .property("__brush", initialize)
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

    group.selectAll(".selection")
      .data([{type: "selection"}])
      .enter().append("rect")
        .attr("class", "selection")
        .attr("cursor", cursors.selection)
        .attr("fill", "rgba(0,0,0,0.15)");

    var resize = group.selectAll(".resize")
      .data(resizes.map(function(t) { return {type: t}; }), function(d) { return d.type; });

    resize.exit().remove();

    resize.enter().append("rect")
        .attr("class", function(d) { return "resize resize--" + d.type; })
        .attr("cursor", function(d) { return cursors[d.type]; })
        .attr("fill", "none");

    group
        .each(redraw)
        .attr("pointer-events", "all")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)")
        .on("mousedown.brush", mousedowned);
  }

  // TODO transitions
  brush.move = function(group, selected) {
    group
        .interrupt()
        .each(typeof selected === "function"
            ? function() { this.__brush.selected = selected.apply(this, arguments); }
            : function() { this.__brush.selected = selected; })
        .each(redraw)
        .each(function() { emitter(this, arguments)("start")("brush")("end"); });
  };

  function redraw() {
    var group = select(this),
        l = local(this);

    if (l.selected) {
      group.selectAll(".selection")
          .style("display", null)
          .attr("x", l.selected[0][0])
          .attr("y", l.selected[0][1])
          .attr("width", l.selected[1][0] - l.selected[0][0])
          .attr("height", l.selected[1][1] - l.selected[0][1]);

      group.selectAll(".resize")
          .style("display", null)
          .attr("x", function(d) { return d.type[d.type.length - 1] === "e" ? l.selected[1][0] - 3 : l.selected[0][0] - 3; })
          .attr("y", function(d) { return d.type[0] === "s" ? l.selected[1][1] - 3 : l.selected[0][1] - 3; })
          .attr("width", function(d) { return d.type === "n" || d.type === "s" ? l.selected[1][0] - l.selected[0][0] + 6 : 6; })
          .attr("height", function(d) { return d.type === "e" || d.type === "w" ? l.selected[1][1] - l.selected[0][1] + 6 : 6; });
    }

    else {
      group.selectAll(".selection,.resize")
          .style("display", "none")
          .attr("x", null)
          .attr("y", null)
          .attr("width", null)
          .attr("height", null);
    }
  }

  function emitter(that, args) {
    return function emit(type) {
      customEvent(new BrushEvent(brush, type, that.__brush), listeners.apply, listeners, [type, that, args]);
      return emit;
    };
  }

  function mousedowned() {
    var that = this,
        group = select(that),
        data = event.target.__data__,
        type = data.type,
        l = local(that),
        x0 = l.selected[0][0],
        y0 = l.selected[0][1],
        x1 = l.selected[1][0],
        y1 = l.selected[1][1],
        point0 = mouse(that),
        point,
        emit = emitter(that, arguments);

    select(event.view)
        .on("keydown.brush", keydowned, true)
        .on("keyup.brush", keyupped, true)
        .on("mousemove.brush", mousemoved, true)
        .on("mouseup.brush", mouseupped, true);

    dragDisable(event.view);
    group.interrupt().selectAll("*").interrupt();
    group.attr("pointer-events", "none").selectAll(".background").attr("cursor", cursors[type]);
    emit("start");

    function mousemoved() {
      point = mouse(that);

      var dx = point[0] - point0[0],
          dy = point[1] - point0[1];

      if (type === "selection") {
        if (data.type === type || data.type[0] === "n" || data.type[0] === "s") {
          l.selected[0][1] = y0 + dy;
          l.selected[1][1] = y1 + dy;
        }
        if (data.type === type || data.type[data.type.length - 1] === "e" || data.type[data.type.length - 1] === "w") {
          l.selected[0][0] = x0 + dx;
          l.selected[1][0] = x1 + dx;
        }
      }

      else if (resizesXY.indexOf(type) >= 0) {
        if (type[0] === "n") {
          l.selected[0][1] = Math.min(y0 + dy, y1);
          l.selected[1][1] = Math.max(y0 + dy, y1);
        } else if (type[0] === "s") {
          l.selected[0][1] = Math.min(y0, y1 + dy);
          l.selected[1][1] = Math.max(y0, y1 + dy);
        }
        if (type[type.length - 1] === "e") {
          l.selected[0][0] = Math.min(x0, x1 + dx);
          l.selected[1][0] = Math.max(x0, x1 + dx);
        } else if (type[type.length - 1] === "w") {
          l.selected[0][0] = Math.min(x0 + dx, x1);
          l.selected[1][0] = Math.max(x0 + dx, x1);
        }
      }

      redraw.call(that);
      emit("brush");
    }

    function mouseupped() {
      dragEnable(event.view);
      group.attr("pointer-events", "all").selectAll(".background").attr("cursor", cursors.background);
      select(event.view).on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
      emit("end");
    }

    function keydowned() {
      if (event.keyCode == 32) {
        if (type !== "selection") {
          x0 = l.selected[0][0];
          y0 = l.selected[0][1];
          x1 = l.selected[1][0];
          y1 = l.selected[1][1];
          point0 = point;
          type = "selection";
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function keyupped() {
      if (event.keyCode == 32) {
        if (data.type !== type) { // TODO This ain’t right.
          x0 = l.selected[0][0];
          y0 = l.selected[0][1];
          x1 = l.selected[1][0];
          y1 = l.selected[1][1];
          point0 = point;
          type = data.type;
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  function initialize() {
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
