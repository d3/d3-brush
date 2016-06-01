import {dispatch} from "d3-dispatch";
import {dragDisable, dragEnable} from "d3-drag";
import {customEvent, mouse, select} from "d3-selection";
import constant from "./constant";
import BrushEvent from "./event";

var MODE_DRAG = {name: "drag"},
    MODE_SPACE = {name: "space"},
    MODE_RESIZE = {name: "resize"},
    MODE_CENTER = {name: "center"},
    N = "n", E = "e", S = "s", W = "w", NW = "nw", NE = "ne", SE = "se", SW = "sw",
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

var signsX = {
  background: +1,
  selection: +1,
  n: null,
  e: +1,
  s: null,
  w: -1,
  nw: -1,
  ne: +1,
  se: +1,
  sw: -1
};

var signsY = {
  background: +1,
  selection: +1,
  n: -1,
  e: null,
  s: +1,
  w: null,
  nw: -1,
  ne: -1,
  se: +1,
  sw: +1
};

function defaultExtent() {
  var svg = this.ownerSVGElement;
  return [[0, 0], svg
      ? [svg.width.baseVal.value, svg.height.baseVal.value]
      : [this.clientWidth, this.clientHeight]];
}

// Like d3.local, but with the name “__brush” rather than auto-generated.
function local(node) {
  while (!node.__brush) if (!(node = node.parentNode)) return;
  return node.__brush;
}

export default function() {
  var extent = defaultExtent,
      listeners = dispatch(brush, "start", "brush", "end"),
      resizes = resizesXY;

  // TODO tell the brush whether you can brush in x, y or x and y?
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
        selected = local(this).selected;

    if (selected) {
      group.selectAll(".selection")
          .style("display", null)
          .attr("x", selected[0][0])
          .attr("y", selected[0][1])
          .attr("width", selected[1][0] - selected[0][0])
          .attr("height", selected[1][1] - selected[0][1]);

      group.selectAll(".resize")
          .style("display", null)
          .attr("x", function(d) { return d.type[d.type.length - 1] === "e" ? selected[1][0] - 3 : selected[0][0] - 3; })
          .attr("y", function(d) { return d.type[0] === "s" ? selected[1][1] - 3 : selected[0][1] - 3; })
          .attr("width", function(d) { return d.type === "n" || d.type === "s" ? selected[1][0] - selected[0][0] + 6 : 6; })
          .attr("height", function(d) { return d.type === "e" || d.type === "w" ? selected[1][1] - selected[0][1] + 6 : 6; });
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
        type = event.target.__data__.type,
        mode = type === "selection" ? MODE_DRAG : (event.altKey ? MODE_CENTER : MODE_RESIZE),
        signX = signsX[type],
        signY = signsY[type],
        l = local(that),
        extent = l.extent,
        selected = l.selected,
        W = extent[0][0], w0 = selected[0][0], w1 = w0,
        N = extent[0][1], n0 = selected[0][1], n1 = n0,
        E = extent[1][0], e0 = selected[1][0], e1 = e0,
        S = extent[1][1], s0 = selected[1][1], s1 = s0,
        dx, dy,
        point0 = mouse(that),
        point,
        emit = emitter(that, arguments);

    if (type === "background") {
      w0 = e0 = selected[0][0] = selected[1][0] = point0[0];
      n0 = s0 = selected[0][1] = selected[1][1] = point0[1];
    }

    var view = select(event.view)
        .on("keydown.brush", keydowned, true)
        .on("keyup.brush", keyupped, true)
        .on("mousemove.brush", mousemoved, true)
        .on("mouseup.brush", mouseupped, true);

    var group = select(that)
        .interrupt()
        .attr("pointer-events", "none");

    group.selectAll("*")
        .interrupt();

    group.selectAll(".background")
        .attr("cursor", cursors[type]);

    dragDisable(event.view);
    redraw.call(that);
    emit("start");

    function mousemoved() {
      point = mouse(that);
      moved();
    }

    function moved() {
      var t;

      dx = point[0] - point0[0];
      dy = point[1] - point0[1];

      switch (mode) {
        case MODE_SPACE:
        case MODE_DRAG: {
          if (signX) dx = Math.max(W - w0, Math.min(E - e0, dx)), w1 = w0 + dx, e1 = e0 + dx;
          if (signY) dy = Math.max(N - n0, Math.min(S - s0, dy)), n1 = n0 + dy, s1 = s0 + dy;
          break;
        }
        case MODE_RESIZE: {
          if (signX < 0) dx = Math.max(W - w0, Math.min(E - w0, dx)), w1 = w0 + dx, e1 = e0;
          else if (signX > 0) dx = Math.max(W - e0, Math.min(E - e0, dx)), w1 = w0, e1 = e0 + dx;
          if (signY < 0) dy = Math.max(N - n0, Math.min(S - n0, dy)), n1 = n0 + dy, s1 = s0;
          else if (signY > 0) dy = Math.max(N - s0, Math.min(S - s0, dy)), n1 = n0, s1 = s0 + dy;
          break;
        }
        case MODE_CENTER: {
          if (signX) dx *= signX, w1 = Math.max(W, Math.min(E, w0 - dx)), e1 = Math.max(W, Math.min(E, e0 + dx));
          if (signY) dy *= signY, n1 = Math.max(N, Math.min(S, n0 - dy)), s1 = Math.max(N, Math.min(S, s0 + dy));
          break;
        }
      }

      // TODO update the background cursor when flipping!
      if (e1 < w1) t = w0, w0 = e0, e0 = t, t = w1, w1 = e1, e1 = t, signX *= -1;
      if (s1 < n1) t = n0, n0 = s0, s0 = t, t = n1, n1 = s1, s1 = t, signY *= -1;

      if (selected[0][0] !== w1
          || selected[0][1] !== e1
          || selected[1][0] !== s1
          || selected[1][1] !== n1) {
        selected[0][0] = w1;
        selected[0][1] = n1;
        selected[1][0] = e1;
        selected[1][1] = s1;
        redraw.call(that);
        emit("brush");
      }
    }

    function mouseupped() {
      dragEnable(event.view);
      group.attr("pointer-events", "all");
      group.selectAll(".background").attr("cursor", cursors.background);
      view.on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
      emit("end");
    }

    function keydowned() {
      switch (event.keyCode) {
        case 18: { // ALT
          if (mode === MODE_RESIZE) {
            if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
            if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
            mode = MODE_CENTER;
            moved();
          }
          break;
        }
        case 32: { // SPACE
          if (mode === MODE_RESIZE) {
            if (signX < 0) e0 = e1 - dx; else if (signX > 0) w0 = w1 - dx;
            if (signY < 0) s0 = s1 - dy; else if (signY > 0) n0 = n1 - dy;
            mode = MODE_SPACE;
            moved();
          }
          break;
        }
        case 16: { // SHIFT
          break;
        }
        default: return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    // TODO ALT and SPACE?
    function keyupped() {
      switch (event.keyCode) {
        case 18: // ALT
        case 32: { // SPACE
          if (mode === MODE_SPACE || mode === MODE_CENTER) {
            if (signX < 0) e0 = e1; else if (signX > 0) w0 = w1;
            if (signY < 0) s0 = s1; else if (signY > 0) n0 = n1;
            mode = MODE_RESIZE;
            moved();
          }
          break;
        }
        case 16: { // SHIFT
          break;
        }
        default: return;
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function initialize() {
    var local = this.__brush || {selected: null};
    local.extent = extent.apply(this, arguments);
    return local;
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
