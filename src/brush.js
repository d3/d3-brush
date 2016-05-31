import {dispatch} from "d3-dispatch";
import {dragDisable, dragEnable} from "d3-drag";
import {customEvent, mouse, select} from "d3-selection";
import constant from "./constant";
import BrushEvent from "./event";

var MODE_DRAG = {},
    MODE_N = {},
    MODE_S = {},
    MODE_E = {},
    MODE_W = {},
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

var modeXs = {
  background: MODE_W,
  selection: MODE_DRAG,
  n: null,
  e: MODE_E,
  s: null,
  w: MODE_W,
  nw: MODE_W,
  ne: MODE_E,
  se: MODE_E,
  sw: MODE_W
};

var modeYs = {
  background: MODE_N,
  selection: MODE_DRAG,
  n: MODE_N,
  e: null,
  s: MODE_S,
  w: null,
  nw: MODE_N,
  ne: MODE_N,
  se: MODE_S,
  sw: MODE_S
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
        type = event.target.__data__.type,
        modeX = modeXs[type],
        modeY = modeYs[type],
        modeX0,
        modeY0,
        l = local(that),
        w = l.selected[0][0],
        n = l.selected[0][1],
        e = l.selected[1][0],
        s = l.selected[1][1],
        point0 = mouse(that),
        point,
        emit = emitter(that, arguments);

    if (type === "background") {
      w = e = l.selected[0][0] = l.selected[1][0] = point0[0];
      n = s = l.selected[0][1] = l.selected[1][1] = point0[1];
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

      var w1 = w, n1 = n, e1 = e, s1 = s,
          dx = point[0] - point0[0],
          dy = point[1] - point0[1];

      switch (modeX) {
        case MODE_DRAG: {
          dx = Math.max(l.extent[0][0] - w, Math.min(l.extent[1][0] - e, dx));
          w1 = w + dx;
          e1 = e + dx;
          break;
        }
        case MODE_W: {
          if (w + dx > e) {
            modeX = w, w = e, e = modeX, modeX = MODE_E;
            w1 = w;
            e1 = clampX(e + dx);
          } else {
            w1 = clampX(w + dx);
          }
          break;
        }
        case MODE_E: {
          if (e + dx < w) {
            modeX = w, w = e, e = modeX, modeX = MODE_W;
            w1 = clampX(w + dx);
            e1 = e;
          } else {
            e1 = clampX(e + dx);
          }
          break;
        }
      }

      switch (modeY) {
        case MODE_DRAG: {
          dy = Math.max(l.extent[0][1] - n, Math.min(l.extent[1][1] - s, dy));
          n1 = n + dy;
          s1 = s + dy;
          break;
        }
        case MODE_N: {
          if (n + dy > s) {
            modeY = n, n = s, s = modeY, modeY = MODE_S;
            n1 = n;
            s1 = clampY(s + dy);
          } else {
            n1 = clampY(n + dy);
          }
          break;
        }
        case MODE_S: {
          if (s + dy < n) {
            modeY = n, n = s, s = modeY, modeY = MODE_N;
            n1 = clampY(n + dy);
            s1 = s;
          } else {
            s1 = clampY(s + dy);
          }
          break;
        }
      }

      if (l.selected[0][0] !== w1
          || l.selected[0][1] !== e1
          || l.selected[1][0] !== s1
          || l.selected[1][1] !== n1) {
        l.selected[0][0] = w1;
        l.selected[0][1] = n1;
        l.selected[1][0] = e1;
        l.selected[1][1] = s1;
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
      if (event.keyCode == 32) {
        if (modeX === MODE_E || modeX === MODE_W) {
          modeX0 = modeX, modeX = MODE_DRAG;
          w = l.selected[0][0];
          e = l.selected[1][0];
          point0[0] = point[0];
        }
        if (modeY === MODE_N || modeY === MODE_S) {
          modeY0 = modeY, modeY = MODE_DRAG;
          n = l.selected[0][1];
          s = l.selected[1][1];
          point0[1] = point[1];
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function keyupped() {
      if (event.keyCode == 32) {
        if (modeX0) {
          modeX = modeX0, modeX0 = null;
          w = l.selected[0][0];
          e = l.selected[1][0];
          point0[0] = point[0];
        }
        if (modeY0) {
          modeY = modeY0, modeY0 = null;
          n = l.selected[0][1];
          s = l.selected[1][1];
          point0[1] = point[1];
        }
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function clampX(x) {
      return Math.min(l.extent[1][0], Math.max(l.extent[0][0], x));
    }

    function clampY(y) {
      return Math.min(l.extent[1][1], Math.max(l.extent[0][1], y));
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
