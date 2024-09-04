/*
 * Hypersolid, Four-dimensional solid viewer
 * 
 * Copyright (c) 2014 Milosz Kosmider <milosz@milosz.ca>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

(function(Hypersolid) {
  /* Begin constants. */

  DEFAULT_VIEWPORT_WIDTH = 420; // Width of canvas in pixels
  DEFAULT_VIEWPORT_HEIGHT = 420; // Height of canvas in pixels
  DEFAULT_VIEWPORT_SCALE = 2; // Maximum distance from origin (in math units) that will be displayed on the canvas
  DEFAULT_VIEWPORT_FONT = 'italic 10px sans-serif';
  DEFAULT_VIEWPORT_FONT_COLOR = '#000';
  DEFAULT_VIEWPORT_LINE_WIDTH = 4;
  DEFAULT_VIEWPORT_LINE_JOIN = 'round';
  DEFAULT_TITLE = '';
  DEFAULT_CHECKBOX_VALUES = {
    //indices: { checked: true },
    //edges: { checked: true }
  };

  /* End constants. */

  /* Begin classes. */

  Hypersolid.Shape = function() {
    return new Shape(Array.prototype.slice.call(arguments, 0));
  };
  function Shape(argv) {
    var self = this,
      vertices = argv[0],
      edges = argv[1],
      labels = argv[2];
      // initialize min stress as infinity
      minStressMetrics = {stress: Infinity, trustworthiness: 0};
      window.minStressRotation = {xy: 180, yz: 0, xz: 0, xw: 180, yw: 0, zw: 0};
      minStressColorRange = 240;
      // initialize max trustworthiness as 0
      maxTrustworthinessMetrics = {trustworthiness: 0, stress: Infinity};
      window.maxTrustworthinessRotation = {xy: 180, yz: 0, xz: 0, xw: 180, yw: 0, zw: 0};
      maxTrustworthinessColorRange = 240;
      // initialize max silhouette coefficients per class as -1
      // and the rotation for the max silhouette coefficients as the starting rotation
      var uniqueLabels = [...new Set(labels)];
      window.maxSilhouetteCoefficients = {};
      window.maxSilhouetteRotations = {};
      window.maxSilhouetteColorRange = {};
      for (var i in uniqueLabels) {
        if (typeof uniqueLabels[i] == 'string') {
          continue;
        }
        window.maxSilhouetteCoefficients[uniqueLabels[i]] = -1;
        window.maxSilhouetteRotations[uniqueLabels[i]] = {xy: 180, yz: 0, xz: 0, xw: 180, yw: 0, zw: 0};
        window.maxSilhouetteColorRange[uniqueLabels[i]] = 240;
      }
      // initialize the slider rotations
      sliderRotations = {xy: Math.PI, xz: 0, xw: 0, yz: Math.PI, yw: 0, zw: 0};
      window.orthogRotations = {
        240: {
          xy: {xy: 180, yz: 180, xz: 0, xw: 0, yw: 0, zw: 0},
          xz: {xy: 0, yz: 90, xz: 180, xw: 0, yw: 0, zw: 270},
          xw: {xy: 180, yz: 0, xz: 0, xw: 0, yw: 270, zw: 90},
          yz: {xy: 90, yz: 0, xz: 270, xw: 0, yw: 180, zw: 0},
          yw: {xy: 0, yz: 180, xz: 90, xw: 270, yw: 0, zw: 0},
          zw: {xy: 90, yz: 0, xz: 270, xw: 0, yw: 270, zw: 90}
        }
      };
      window.hiddenLabels = [];
      // convert the orthogRotations to radians
      for (var angle in window.orthogRotations) {
        for (var axis in window.orthogRotations[angle]) {
          for (var rotAxis in window.orthogRotations[angle][axis]) {
            window.orthogRotations[angle][axis][rotAxis] = window.orthogRotations[angle][axis][rotAxis] * Math.PI / 180;
          }
        }
      };

    // Rotations will always be relative to the original shape to avoid rounding errors.
    // This is a structure for caching the rotated vertices.
    var rotatedVertices = new Array(vertices.length);
    copyVertices();

    // This is where we store the current rotations about each axis.
    var rotations = { xy: Math.PI, xz: 0, xw: 0, yz: Math.PI, yw: 0, zw: 0 };

    // we rotate in the order: (xz, xw, yw, xy, yz, zw)
    // this seemed to give the most uniform coverage
    var rotationOrder = {
      xz: 1,
      xw: 1,
      yw: 1,
      xy: 1,
      yz: 1,
      zw: 1
    };

    // Multiplication by vector rotation matrices of dimension 4
    var rotateVertex = {
      xy: function(v, s, c) {
        tmp = c * v.x + s * v.y;
        v.y = -s * v.x + c * v.y;
        v.x = tmp;
      },
      xz: function(v, s, c) {
        tmp = c * v.x + s * v.z;
        v.z = -s * v.x + c * v.z;
        v.x = tmp;
      },
      xw: function(v, s, c) {
        tmp = c * v.x + s * v.w;
        v.w = -s * v.x + c * v.w;
        v.x = tmp;
      },
      yz: function(v, s, c) {
        tmp = c * v.y + s * v.z;
        v.z = -s * v.y + c * v.z;
        v.y = tmp;
      },
      yw: function(v, s, c) {
        tmp = c * v.y + s * v.w;
        v.w = -s * v.y + c * v.w;
        v.y = tmp;
      },
      zw: function(v, s, c) {
        tmp = c * v.z + s * v.w;
        v.w = -s * v.z + c * v.w;
        v.z = tmp;
      }
    };

    var eventCallbacks = {};

    self.getOriginalVertices = function() {
      return vertices;
    };

    self.getVertices = function() {
      return rotatedVertices;
    };

    self.getEdges = function() {
      return edges;
    };

    self.getLabels = function() {
      return labels;
    };

    self.getRotations = function() {
      return rotations;
    };

    self.setStressRotations = function(animated = false) {
      self.setSliderAngles(window.minStressRotation);
      if (animated) {
        // animate the rotations to the min stress rotations
        // estimate the number of frames to animate based on the current rotations
        var sumDiffRotations = 0;
        var diffRotations = {};
        for (var axis in rotations) {
          // there are 3 possibilities for the difference in rotations
          // b-a, b+2pi-a, b-2pi-a
          // we choose the smallest difference
          var possibilities = [window.minStressRotation[axis] - rotations[axis], 
                               window.minStressRotation[axis] + 2*Math.PI - rotations[axis], 
                               window.minStressRotation[axis] - 2*Math.PI - rotations[axis]];
          var diff = possibilities.reduce(function(prev, curr) {
            return (Math.abs(curr) < Math.abs(prev) ? curr : prev);
          });
          diffRotations[axis] = diff;
          sumDiffRotations += Math.abs(diff);
        };
        // convert sumDiffRotations to degrees
        sumDiffRotations = sumDiffRotations * 180 / Math.PI;
        var nFrames = Math.max(sumDiffRotations / 6, 50) 
        // round to the nearest integer
        nFrames = Math.round(nFrames);
        var step = {};
        for (var axis in rotations) {
          step[axis] = (diffRotations[axis]) / nFrames;
        }
        var i = 0;
        var interval = setInterval(function() {
          for (var axis in rotations) {
            var newRot = (rotations[axis] + step[axis]) % (2 * Math.PI);
            // if the new rotation is negative, we add 2pi to make it positive
            if (newRot < 0) {
              newRot += 2*Math.PI;
            }
            rotations[axis] = newRot;
          }
          //setRotations(rotations);
          applyRotations();
          triggerEventCallbacks('rotate');
          // redraw the viewport
          // true to skip the summary; otherwise we can find views that are not reachable through the sliders
          window.draw(true);
          i++;
          if (i == nFrames) {
            clearInterval(interval);
          }
        }, 10);
      }
      else {
        for (var axis in window.minStressRotation) {
          rotations[axis] = window.minStressRotation[axis];
        }
      }
      // set the color range to the min stress color range
      document.getElementById('deg-part').value = minStressColorRange;
      // update the deg-part-value span
      document.getElementById('deg-part-value').innerHTML = minStressColorRange + '°';
      // simulate input event to update the gradients as well
      document.getElementById('deg-part').dispatchEvent(new Event('input'));
      return rotations;
    };


    self.setTrustRotations = function(animated = false) {
      self.setSliderAngles(window.maxTrustworthinessRotation);
      if (animated) {
        // animate the rotations to the max trustworthiness rotations
        // estimate the number of frames to animate based on the current rotations
        var sumDiffRotations = 0;
        var diffRotations = {};
        for (var axis in rotations) {
          // there are 3 possibilities for the difference in rotations
          // b-a, b+2pi-a, b-2pi-a
          // we choose the smallest difference
          var possibilities = [window.maxTrustworthinessRotation[axis] - rotations[axis], 
                               window.maxTrustworthinessRotation[axis] + 2*Math.PI - rotations[axis], 
                               window.maxTrustworthinessRotation[axis] - 2*Math.PI - rotations[axis]];
          var diff = possibilities.reduce(function(prev, curr) {
            return (Math.abs(curr) < Math.abs(prev) ? curr : prev);
          });
          diffRotations[axis] = diff;
          sumDiffRotations += Math.abs(diff);
        };
        // convert sumDiffRotations to degrees
        sumDiffRotations = sumDiffRotations * 180 / Math.PI;
        var nFrames = Math.max(sumDiffRotations / 6, 50) 
        // round to the nearest integer
        nFrames = Math.round(nFrames);
        var step = {};
        for (var axis in rotations) {
          step[axis] = (diffRotations[axis]) / nFrames;
        }
        var i = 0;
        var interval = setInterval(function() {
          for (var axis in rotations) {
            var newRot = (rotations[axis] + step[axis]) % (2 * Math.PI);
            // if the new rotation is negative, we add 2pi to make it positive
            if (newRot < 0) {
              newRot += 2*Math.PI;
            }
            rotations[axis] = newRot;
          }
          //setRotations(rotations);
          applyRotations();
          triggerEventCallbacks('rotate');
          // redraw the viewport
          // true to skip the summary; otherwise we can find views that are not reachable through the sliders
          window.draw(true);
          i++;
          if (i == nFrames) {
            clearInterval(interval);
          }
        }, 10);
      }
      else {
        for (var axis in window.maxTrustworthinessRotation) {
          rotations[axis] = window.maxTrustworthinessRotation[axis];
        }
      }
      // set the color range to the max trustworthiness color range
      document.getElementById('deg-part').value = maxTrustworthinessColorRange;
      // update the deg-part-value span
      document.getElementById('deg-part-value').innerHTML = maxTrustworthinessColorRange + '°';
      // simulate input event to update the gradients as well
      document.getElementById('deg-part').dispatchEvent(new Event('input'));
      return rotations;
    };

    self.setCustomRotations = function(custRotations, animated = false) {
      self.setSliderAngles(custRotations);
      if (animated) {
        // animate the rotations to the custom rotations
        // estimate the number of frames to animate based on the current rotations
        var sumDiffRotations = 0;
        var diffRotations = {};
        for (var axis in rotations) {
          // there are 3 possibilities for the difference in rotations
          // b-a, b+2pi-a, b-2pi-a
          // we choose the smallest difference
          var possibilities = [custRotations[axis] - rotations[axis], custRotations[axis] + 2*Math.PI - rotations[axis], custRotations[axis] - 2*Math.PI - rotations[axis]];
          var diff = possibilities.reduce(function(prev, curr) {
            return (Math.abs(curr) < Math.abs(prev) ? curr : prev);
          });
          diffRotations[axis] = diff;
          sumDiffRotations += Math.abs(diff);
        };
        // convert sumDiffRotations to degrees
        sumDiffRotations = sumDiffRotations * 180 / Math.PI;
        var nFrames = Math.max(sumDiffRotations / 6, 50) 
        // round to the nearest integer
        nFrames = Math.round(nFrames);
        var step = {};
        for (var axis in rotations) {
          step[axis] = (diffRotations[axis]) / nFrames;
        }
        var i = 0;
        var interval = setInterval(function() {
          for (var axis in rotations) {
            var newRot = (rotations[axis] + step[axis]) % (2 * Math.PI);
            // if the new rotation is negative, we add 2pi to make it positive
            if (newRot < 0) {
              newRot += 2*Math.PI;
            }
            rotations[axis] = newRot;
          }
          //setRotations(rotations);
          applyRotations();
          triggerEventCallbacks('rotate');
          // redraw the viewport
          // true to skip the summary; otherwise we can find views that are not reachable through the sliders
          window.draw(true);
          i++;
          if (i == nFrames) {
            clearInterval(interval);
          }
        }, 10);
      }
      else {
        for (var axis in custRotations) {
          rotations[axis] = custRotations[axis];
        }
        applyRotations();
        triggerEventCallbacks('rotate');
        window.draw(true);
      }
      return rotations;
    };

    self.getMinStressMetrics = function() {
      return minStressMetrics;
    };

    self.getMaxTrustworthinessMetrics = function() {
      return maxTrustworthinessMetrics;
    };

    self.convertSlider = function(rotDirections, angle) {
      // shift the angle 90 degrees to the left and take the modulo 360
      angle = (angle + 90) % 360;
      let nParts = rotDirections.length;
      // rotDirections is an array of strings, e.g. ['xy', 'xz']
      let converted = {}
      // we want some overlap between parts
      let degreesPerPart = document.getElementById('deg-part').value
      // the centers of the parts will be 0, 360/nParts, 2*360/nParts, ...
      // the range of the parts will be [center - degreesPerPart/2, center + degreesPerPart/2]
      for (let i = 0; i < nParts; i++) {
          let center = i * 360/nParts;
          let lowerBound = center - degreesPerPart/2;
          let upperBound = center + degreesPerPart/2;
          // if the angle is in the range [lowerBound, upperBound], we have found the correct part
          // mind that it can also be in range [lowerBound + 360, upperBound + 360]
          if ((angle >= lowerBound && angle <= upperBound) || (angle >= lowerBound + 360 && angle <= upperBound + 360)) {
              // the angle is in the range of this rotation
              // the converted angle represents how far the angle
              // is in the range of the current rotation (i.e. distance from lower bound)
              let convertedAngle = angle - lowerBound;
              // it might be a multiple of 360, so we need to take the modulo 360
              convertedAngle = convertedAngle % 360;
              // convert the angle to the range [0, 360]
              convertedAngle = convertedAngle * (360/degreesPerPart);
              converted[rotDirections[i]] = convertedAngle;
          }
          else {
            // if the angle is not in the range of this rotation
            // we just set the converted angle to 0
            converted[rotDirections[i]] = 0;
          } 
      }
      return converted;
    };

    self.inverseConvert = function(rotDirections, converted) {
      // converts the rotations back to the slider angles
      let nParts = rotDirections.length;
      let degreesPerPart = document.getElementById('deg-part').value
      let angle = 0;

      for (let i = 0; i < nParts; i++) {
          let center = i * 360/nParts;
          let lowerBound = center - degreesPerPart/2;
          let upperBound = center + degreesPerPart/2;
          let convertedAngle = converted[rotDirections[i]];
          // check if the converted angle is not 0, which means it's the active part
          if (Math.round(convertedAngle) !== 0) {
              // convert the angle back to the range of the current rotation
              convertedAngle = convertedAngle * (degreesPerPart/360);
              // add the lower bound to get the original angle
              angle = lowerBound + convertedAngle;
          }
      }
      // mind that the slider angle is shifted 90deg
      // compared to the angle we want (unit circle starts at 3 o'clock)
      // so we subtract 90 degrees
      return angle - 90;
    }


    self.rotationsToSlider = function(rotations) {
      // get the horizontal and vertical directions
      horDirections = ['xy', 'xw', 'xz'];
      verDirections = ['yz', 'yw', 'zw'];
      // convert the rotations from radians to degrees
      horRotations = {};
      verRotations = {};
      for (var axis in rotations) {
        if (horDirections.includes(axis)) {
          horRotations[axis] = rotations[axis] * 180 / Math.PI;
        }
        else if (verDirections.includes(axis)) {
          verRotations[axis] = rotations[axis] * 180 / Math.PI;
        }
      }

      // use the inverse conversion to get the angles for the sliders
      var lastAngleHDisplay = self.inverseConvert(horDirections, horRotations);
      var lastAngleVDisplay = self.inverseConvert(verDirections, verRotations);

      // convert the angle from degrees back to radians
      var lastAngleH = lastAngleHDisplay * Math.PI / 180;
      var lastAngleV = lastAngleVDisplay * Math.PI / 180;
      
      return [lastAngleH, lastAngleV];
    };

    self.updateSlider = function() {
      // get the handles
      var sliderH = document.getElementById('handle-h');
      var sliderV = document.getElementById('handle-v');
      // and the tracks
      var sliderHPath = document.getElementById('track-h');
      var sliderVPath = document.getElementById('track-v');
      // define the center of the slider track
      var circleH = sliderHPath.getBoundingClientRect();
      var circleV = sliderVPath.getBoundingClientRect();
      var centerHX = circleH.width / 2;
      var centerHY = circleH.height / 2;
      var centerVX = circleV.width / 2;
      var centerVY = circleV.height / 2;
      // small correction to the radius to align handle
      var correctionRadius = 7.5;
      var radiusH = sliderHPath.offsetWidth / 2 - correctionRadius;
      var radiusV = sliderVPath.offsetHeight / 2 - correctionRadius;
      // define the slider handle positions
      var sliderHX = centerHX + radiusH * Math.cos(window.lastAngleH);
      var sliderHY = centerHY + radiusH * Math.sin(window.lastAngleH);
      var sliderVX = centerVX + radiusV * Math.cos(window.lastAngleV);
      var sliderVY = centerVY + radiusV * Math.sin(window.lastAngleV);
      // small correction to the slider handle position
      var correctionSlider = -2.5;
      // set the slider handle positions
      sliderH.style.left = sliderHX+correctionSlider + 'px';
      sliderH.style.top = sliderHY+correctionSlider + 'px';
      sliderV.style.left = sliderVX+correctionSlider + 'px';
      sliderV.style.top = sliderVY+correctionSlider + 'px';
      };

    self.setSliderAngles = function(rotations) {
      //console.log('setting slider angles to match rotations' + JSON.stringify(rotations));
      var sliderAngles = self.rotationsToSlider(rotations);
      window.lastAngleH = sliderAngles[0];
      window.lastAngleV = sliderAngles[1];
      //console.log('slider angles set to ' + window.lastAngleH + ' and ' + window.lastAngleV);
      self.updateSlider();
    };



    self.setSliderRotations = function() {
      for (var axis in sliderRotations) {
        rotations[axis] = sliderRotations[axis];
      }
    };


    self.getDistances = function(vertices1, vertices2, axes) {
      // compute the distances between all pairs of points
      var interpoint_distances = Array(vertices1.length).fill().map(() => Array(vertices2.length).fill(NaN));
      for (var i = 0; i < vertices1.length; i++) {
        for (var j = 0; j < vertices2.length; j++) {
          var dist_count = 0;
          for (var k in axes) {
            dist_count += Math.pow(vertices1[i][axes[k]] - vertices2[j][axes[k]], 2);
          }
          var dist = Math.sqrt(dist_count);
          interpoint_distances[i][j] = dist;

        }
      }
      return interpoint_distances;
    }

    // This will copy the original shape and put a rotated version into rotatedVertices
    // we also update the summary of the current projection
    self.rotate = function(axis, theta)  {
      addToRotation(axis, theta);
      applyRotations();
      triggerEventCallbacks('rotate');
    };


    self.on = function(eventName, callback) {
      if (eventCallbacks[eventName] === undefined) {
        eventCallbacks[eventName] = [];
      }
      eventCallbacks[eventName].push(callback);
    };

    function triggerEventCallbacks(eventName) {
      if (eventCallbacks[eventName] !== undefined) {
        for (index in eventCallbacks[eventName]) {
          eventCallbacks[eventName][index].call(self);
        }
      }
    }
    // update the rotation of a specific axis
    function addToRotation(axis, theta) {
      rotations[axis] = (rotations[axis] + theta) % (2 * Math.PI);
    }
    // set the rotation of a specific axis
    function setRotations(newRotations) {
      rotations = newRotations;
    }

    function applyRotations() {
      copyVertices();

      for (var axis in rotationOrder) {
        // sin and cos precomputed for efficiency
        var s = Math.sin(rotations[axis]);
        var c = Math.cos(rotations[axis]);

        for (var i in vertices)
        {
          rotateVertex[axis](rotatedVertices[i], s, c);
        }
      }
      window.viewFindNRotations += 1;
    }

    self.rotationsToFeatureContributions = function(rotations) {
      // convert the rotations to feature contributions
      // we have 6 rotations, but only 4 axes
      // we compute feature contributions by rotating a 4x4 identity matrix
      // with the rotations
      var identity = [{x: 1, y: 0, z: 0, w: 0},
                      {x: 0, y: 1, z: 0, w: 0},
                      {x: 0, y: 0, z: 1, w: 0},
                      {x: 0, y: 0, z: 0, w: 1}];
      for (var axis in rotationOrder) {
        // sin and cos precomputed for efficiency
        var s = Math.sin(rotations[axis]);
        var c = Math.cos(rotations[axis]);
        for (var i in identity) { 
          rotateVertex[axis](identity[i], s, c);
        }
      } 
      // compute the feature contributions
      xContrib = Math.sqrt(Math.pow(identity[0].x, 2) + Math.pow(identity[0].y, 2));
      yContrib = Math.sqrt(Math.pow(identity[1].x, 2) + Math.pow(identity[1].y, 2));
      zContrib = Math.sqrt(Math.pow(identity[2].x, 2) + Math.pow(identity[2].y, 2));
      wContrib = Math.sqrt(Math.pow(identity[3].x, 2) + Math.pow(identity[3].y, 2));
      featureContributions = {x: xContrib, y: yContrib, z: zContrib, w: wContrib};
      return featureContributions;
    }

    function copyVertices() {
      for (var i in vertices) {
        var vertex = vertices[i];
        rotatedVertices[i] = {
          x: vertex.x,
          y: vertex.y,
          z: vertex.z,
          w: vertex.w
        };
      }
    }
  }

  Hypersolid.Viewport = function() {
    return new Viewport(Array.prototype.slice.call(arguments, 0));
  };
  function Viewport(argv) {
    var self = this,
      shape = argv[0],
      canvas = argv[1],
      options = argv[2],
      axes = argv[3],
      viewKind = argv[4];
    // compute the high-dimensional distances between all pairs of points
    // TODO: make high-dimensional distances an initial parameter
    // for now we just use the 4D distances to simulate high-dimensional distances
    window.metricSampleSize = 300;
    if (shape.getVertices().length <= window.metricSampleSize) {
      window.hd_distances = shape.getDistances(shape.getVertices(), shape.getVertices(), ['x', 'y', 'z', 'w']);
      window.hd_distances_sq = window.hd_distances.map(function(row) {
        return row.map(function(dist) {
          return Math.pow(dist, 2);
        });
      });
    }
    else {
      // if length of vertices > window.metricSampleSize, we sample window.metricSampleSize indices and store those vertices
      // we then compute the distances between these window.metricSampleSize points
      var indices = [];
      while (indices.length < window.metricSampleSize) {
        var randomIndex = Math.floor(Math.random() * shape.getVertices().length);
        if (!indices.includes(randomIndex)) {
          indices.push(randomIndex);
        }
      }
      window.sampleIndices = indices;
      var sampleVertices = shape.getVertices().filter(function(vertex, index) {
        return indices.includes(index);
      });
      // note that we compare the sample vertices to all other vertices
      window.hd_distances = shape.getDistances(sampleVertices, shape.getVertices(), ['x', 'y', 'z', 'w']);
      window.hd_distances_sq = window.hd_distances.map(function(row) {
        return row.map(function(dist) {
          return Math.pow(dist, 2);
        });
      });
    };
    options = options || {};

    var scale = options.scale || DEFAULT_VIEWPORT_SCALE;
    canvas.width = options.width || DEFAULT_VIEWPORT_WIDTH;
    canvas.height = options.height || DEFAULT_VIEWPORT_HEIGHT;
    var bound = Math.min(canvas.width, canvas.height) / 2;

    var context = canvas.getContext('2d');
    context.font = options.font || DEFAULT_VIEWPORT_FONT;
    context.textBaseline = 'top';
    context.fillStyle = options.fontColor || DEFAULT_VIEWPORT_FONT_COLOR;
    context.lineWidth = options.lineWidth || DEFAULT_VIEWPORT_LINE_WIDTH;
    context.lineJoin = options.lineJoin || DEFAULT_VIEWPORT_LINE_JOIN;

    var checkboxes = options.checkboxes || DEFAULT_CHECKBOX_VALUES;

    var clicked = false;
    var startCoords;

    self.draw = function(title, skipTracker = false) {
      var vertices = shape.getVertices();
      var edges = shape.getEdges();
      var labels = shape.getLabels();
      var title = title || DEFAULT_TITLE;
      // if no title is provided, we will use the current axes
      if (title == DEFAULT_TITLE) {
        title = axes[0] + axes[1];
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      var adjusted = [];
      for (var i in vertices) {
        adjusted[i] = {
          x: Math.floor(canvas.width / 2 + bound * (vertices[i].x / scale)) + 0.5,
          y: Math.floor(canvas.height / 2 - bound * (vertices[i].y / scale)) + 0.5,
          z: Math.floor(canvas.height / 2 - bound * (vertices[i].z / scale)) + 0.5,
          w: Math.floor(canvas.height / 2 - bound * (vertices[i].w / scale)) + 0.5
        };
      }
      
      // draw the points
      for (var i in adjusted) {
        // draw a circle around the point
        // let w determine the radius, and z the alpha
        context.beginPath();
        var radius = adjusted.length > 1000 ? canvas.height / 200 : canvas.height / 140;
        if (checkboxes.wsize.checked) {
          radius = radius*(2/3) + 2 * adjusted[i].w / 255;
        }
        // axes variable [x, y] determines which axes to use for the 2D projection
        //var axes = axes || ['x', 'y'];
        // put a title above the canvas with the current axes
        context.font = '16px sans-serif';
        context.fillStyle = 'rgba(0,0,0,0.025)';
        var title_x = canvas.width/2 - title.length * 4;
        context.fillText(title, title_x, 0);
        // fill the circle with the color of the point
        var label = labels[i];
        // colors are seaborn colorblind palette
        var colors = [
          {'r': 1, 'g': 115, 'b': 178},
          {'r': 222, 'g': 143, 'b': 5},
          {'r': 2, 'g': 158, 'b': 115},
          {'r': 213, 'g': 94, 'b': 0},
          {'r': 204, 'g': 120, 'b': 188},
          {'r': 202, 'g': 145, 'b': 97},
          {'r': 251, 'g': 175, 'b': 228},
          {'r': 148, 'g': 148, 'b': 148},
          {'r': 236, 'g': 225, 'b': 51},
          {'r': 86, 'g': 180, 'b': 233}
        ];
        if (checkboxes.zalpha.checked) {
          // mind the rescaling we did: Math.floor(canvas.height / 2 - bound * (vertices[i].z / scale)) + 0.5
          // convert the z value back to a value between 0 and 1
          var alpha = 0.5 + adjusted[i].z / (canvas.height / 2);
          // then rescale it to be between 0 and 0.5 
          alpha = 0.5 * alpha;
        }
        else {
          // if there are hidden labels we also set alpha to 0.8 for better contrast
          var alpha = ((adjusted.length > 200) && window.hiddenLabels.length==0) ? 0.6 : 0.8;
        }
        // if the label is a string, it is an axis label
        if (typeof label == 'string') {
          var axesCheckbox = document.getElementById('axes-checkbox');
          if (axesCheckbox.checked) {
            var color = {'r': 0, 'g': 0, 'b': 0};
            var alpha = 1;
            var radius = 3;
          }
          else {
            continue;
          }
        }
        else {
          var color = colors[label % colors.length];
          // if the label is in window.hiddenLabels and the viewkind is main,
          // we reduce alpha
          // if adjusted.length > 200 we reduce to 0.05, otherwise 0.1
          if (window.hiddenLabels.includes(label) && viewKind=='main') {
            alpha = adjusted.length > 200 ? 0.05 : 0.1;
          }
        }
        context.arc(adjusted[i][axes[0]], adjusted[i][axes[1]], radius, 0, 2 * Math.PI, false);
        context.fillStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';
        context.fill();
        context.closePath();
        //context.fillText(i.toString(), adjusted[i].x, adjusted[i].y);
      }

      // draw the edges
      var axesCheckbox = document.getElementById('axes-checkbox');
      if (axesCheckbox.checked) {
        for (var i in edges) {
          var x = [adjusted[edges[i][0]].x, adjusted[edges[i][1]].x];
          var y = [adjusted[edges[i][0]].y, adjusted[edges[i][1]].y];
          var z = [adjusted[edges[i][0]].z, adjusted[edges[i][1]].z];
          var w = [adjusted[edges[i][0]].w, adjusted[edges[i][1]].w];
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x[0], y[0]);
          context.lineTo(x[1], y[1]);
          context.closePath();
          context.strokeStyle = 'rgba(0,0,0,0.2)';
          context.stroke();
          context.font = 'italic 16px sans-serif';
          context.fillStyle = 'rgba(0,0,0,1)';
          var label = labels[edges[i][1]];
          context.fillText(label, x[1], y[1]);
        }
      }

      // draw a legend for the indices
      var uniqueLabels = [];
      for (var i in labels) {
        if (uniqueLabels.indexOf(labels[i]) == -1) {
          uniqueLabels.push(labels[i]);
        }
      }
      // sort the labels
      uniqueLabels.sort(function(a, b) {
        return a - b;
      });

      // Get the legend container
      var legendContainer = document.getElementById('legend-container');
      // Get the silhouette container
      var silhouetteContainer = document.getElementById('silhouette-container');

      // Clear the current legend
      legendContainer.innerHTML = '';
      silhouetteContainer.innerHTML = '';

      for (var i in uniqueLabels) {	
        if (typeof uniqueLabels[i] == 'string') {
          continue;
        }
        var color = colors[uniqueLabels[i] % colors.length];
        var alpha = window.hiddenLabels.includes(uniqueLabels[i]) ? 0.25 : 1;
        var colorString = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';

        // Create a new legend item
        var legendItem = document.createElement('div');
        legendItem.style.color = 'white';
        legendItem.style.cursor = 'pointer';
        legendItem.style.fontFamily = 'sans-serif';
        legendItem.style.backgroundColor = colorString;
        legendItem.style.padding = '5px';
        legendItem.style.paddingLeft = '10px';
        legendItem.style.paddingRight = '10px';
        legendItem.style.border = '1px solid';
        legendItem.style.borderColor = 'transparent';
        legendItem.style.borderRadius = '5px';
        legendItem.style.userSelect = 'none';
        legendItem.textContent = uniqueLabels[i].toString();
        // Create a new silhouette item
        var silhouetteItem = document.createElement('div');
        silhouetteItem.style.color = 'white';
        silhouetteItem.style.cursor = 'pointer';
        silhouetteItem.style.fontFamily = 'sans-serif';
        silhouetteItem.style.backgroundColor = colorString;
        silhouetteItem.style.padding = '5px';
        silhouetteItem.style.paddingLeft = '10px';
        silhouetteItem.style.paddingRight = '10px';
        silhouetteItem.style.border = '1px solid';
        silhouetteItem.style.borderColor = 'transparent';
        // make it a circle
        silhouetteItem.style.borderRadius = '50%';
        silhouetteItem.style.userSelect = 'none';
        silhouetteItem.textContent = uniqueLabels[i].toString();

        // Add a click event listener to the legend item
        legendItem.addEventListener('click', function() {
          var legendItem = this;
          // if it is in window.hiddenLabels, remove it and set alpha to 1
          if (window.hiddenLabels.includes(parseInt(legendItem.textContent))) {
            window.hiddenLabels = window.hiddenLabels.filter(function(label) {
              return label != parseInt(legendItem.textContent);
            });
            var currentColor = legendItem.style.backgroundColor;
            var rgba = currentColor.replace(/^rgba?\(|\s+|\)$/g,'').split(',');
            rgba[3] = 1;
            legendItem.style.backgroundColor = 'rgba(' + rgba.join(',') + ')';
          }
          // else we add it to window.hiddenLabels and set alpha to 0.5
          else {
            var currentColor = legendItem.style.backgroundColor;
            var rgba = currentColor.replace(/^rgba?\(|\s+|\)$/g,'').split(',');
            rgba[3] = 0.25;
            legendItem.style.backgroundColor = 'rgba(' + rgba.join(',') + ')';
            window.hiddenLabels.push(parseInt(legendItem.textContent));
          }
          window.draw();
        });

        // Add a click event listener to the silhouette item
        // we set the view to the silhouette view for the clicked label
        silhouetteItem.addEventListener('click', function() {
          var silhouetteItem = this;
          // convert the label to an integer
          var label = parseInt(silhouetteItem.textContent);
          window.setView(label, true);
        });

        // Add the legend item to the legend container
        legendContainer.appendChild(legendItem);
        // Add the silhouette item to the silhouette container
        //silhouetteContainer.appendChild(silhouetteItem);
      }

    };

    self.computeStress = function(hd_distances, hd_distances_sq, ld_distances) {
      // compute the stress by comparing the high-dimensional distances to the 2D distances
      // stress = sqrt[ (sum_i (d_i - d'_i)^2) / (sum_i d_i^2) ]
      var n = hd_distances.length;
      var numerator = 0;
      var denominator = 0;
      for (var i in hd_distances) {
        for (var j in hd_distances[i]) {
          if (i < j) {
            var d_ij = hd_distances[i][j];
            var d_ij_sq = hd_distances_sq[i][j];
            var d_ij_prime = ld_distances[i][j];
            numerator += Math.pow(d_ij - d_ij_prime, 2);
            denominator += d_ij_sq;
          }
        }
      }
      var stress = Math.sqrt(numerator / denominator);
      return stress;
    };

    function metricTrustworthiness(k, hd_distances, ld_distances) {
        const n = hd_distances.length;
        const m = hd_distances[0].length;
    
        const nnOrig = hd_distances.map((row, i) => 
            row.map((value, j) => ({value, j}))
            .sort((a, b) => a.value - b.value)
            .map(({j}) => j)
        );
    
        const nnProj = ld_distances.map((row, i) => 
            row.map((value, j) => ({value, j}))
            .sort((a, b) => a.value - b.value)
            .map(({j}) => j)
        );
    
        const knnOrig = nnOrig.map(row => row.slice(1, k + 1));
        const knnProj = nnProj.map(row => row.slice(1, k + 1));
    
        let sumI = 0;
    
        for (let i = 0; i < n; i++) {
            const U = knnProj[i].filter(j => !knnOrig[i].includes(j));
    
            let sumJ = 0;
            for (let j = 0; j < U.length; j++) {
                sumJ += nnOrig[i].indexOf(U[j]) - k;
            }
    
            sumI += sumJ;
        }
        
        return 1 - (2 / (m * k * (2 * m - 3 * k - 1)) * sumI);
    };

    function silhouetteCoefficientClusterwise(ld_distances, labels) {
      var silhouetteCoefficients = {};
      var counts = {};
    
      for (var i = 0; i < ld_distances.length; i++) {
        // if the point label is not numeric, we skip it
        if (typeof labels[i] == 'string') {
          continue;
        }
        var a = averageIntraClusterDistance(i, ld_distances, labels[i], labels);
        var b = averageNearestClusterDistance(i, ld_distances, labels[i], labels);
        var silhouetteCoefficient = (b - a) / Math.max(a, b);
    
        if (silhouetteCoefficients[labels[i]]) {
          silhouetteCoefficients[labels[i]] += silhouetteCoefficient;
          counts[labels[i]] += 1;
        } else {
          silhouetteCoefficients[labels[i]] = silhouetteCoefficient;
          counts[labels[i]] = 1;
        }
      }
    
      for (var label in silhouetteCoefficients) {
        silhouetteCoefficients[label] /= counts[label];
      }
    
      return silhouetteCoefficients;
    }
    
    function averageIntraClusterDistance(index, distances, label, labels) {
      var sum = 0;
      var count = 0;
      for (var i = 0; i < distances.length; i++) {
        if (labels[i] === label) {
          sum += distances[index][i];
          count++;
        }
      }
      return sum / count;
    }
    
    function averageNearestClusterDistance(index, distances, label, labels) {
      var minAverageDistance = Infinity;
      var uniqueLabels = [...new Set(labels)];
      for (var i = 0; i < uniqueLabels.length; i++) {
        if (uniqueLabels[i] !== label) {
          var sum = 0;
          var count = 0;
          for (var j = 0; j < distances.length; j++) {
            if (labels[j] === uniqueLabels[i]) {
              sum += distances[index][j];
              count++;
            }
          }
          var averageDistance = sum / count;
          if (averageDistance < minAverageDistance) {
            minAverageDistance = averageDistance;
          }
        }
      }
      return minAverageDistance;
    }

    self.summarize = function(skipTracker = false) {
      var vertices = shape.getVertices();
      // if length of vertices is over window.metricSampleSize, we use our randomly sampled vertices
      if (vertices.length <= window.metricSampleSize) {
        var interpoint_distances = shape.getDistances(vertices, vertices, axes);
      }
      else {
        var sampleVertices = vertices.filter(function(vertex, index) {
          return window.sampleIndices.includes(index);
        });
        var interpoint_distances = shape.getDistances(sampleVertices, vertices, axes);
      }
      var stress = self.computeStress(window.hd_distances, window.hd_distances_sq, interpoint_distances);
      window.stress = stress;
      var trustworthiness = metricTrustworthiness(10, window.hd_distances, interpoint_distances);
      window.trustworthiness = trustworthiness;
      var silhouetteCoefficients = silhouetteCoefficientClusterwise(interpoint_distances, shape.getLabels());
      window.silhouetteCoefficients = silhouetteCoefficients;
      if ((stress < minStressMetrics.stress) && (!skipTracker)) {
        // update the min stress and trustworthiness
        minStressMetrics = {stress: stress, trustworthiness: trustworthiness};
        // copy the current rotations and color range
        var currentRotations =  JSON.parse(JSON.stringify(shape.getRotations()));
        var currentColorRange = JSON.parse(JSON.stringify(document.getElementById('deg-part').value));
        // update the min stress rotation and stress 
        window.minStressRotation = currentRotations;
        minStressColorRange = currentColorRange;
        window.drawStress();
      }
      if ((trustworthiness > maxTrustworthinessMetrics.trustworthiness) && (!skipTracker)) {
        // update the max trustworthiness and stress
        maxTrustworthinessMetrics = {trustworthiness: trustworthiness, stress: stress};
        // copy the current rotations and color range
        var currentRotations = JSON.parse(JSON.stringify(shape.getRotations()));
        var currentColorRange = JSON.parse(JSON.stringify(document.getElementById('deg-part').value));
        // update the max trustworthiness rotation and color range
        window.maxTrustworthinessRotation = currentRotations;
        maxTrustworthinessColorRange = currentColorRange;
        window.drawTrust();
      }
      for (var label in silhouetteCoefficients) {
        if ((silhouetteCoefficients[label] > window.maxSilhouetteCoefficients[label]) && (!skipTracker)) {
          window.maxSilhouetteCoefficients[label] = silhouetteCoefficients[label];
          var currentRotations = JSON.parse(JSON.stringify(shape.getRotations()));
          var currentColorRange = JSON.parse(JSON.stringify(document.getElementById('deg-part').value));
          window.maxSilhouetteRotations[label] = currentRotations;
          window.maxSilhouetteColorRange[label] = currentColorRange;
        }
      }
      //console.log(window.maxSilhouetteCoefficients);
    };

    self.fillSummary = function(stress, trustworthiness) {
      summary_S = 'S: ' + stress.toFixed(2)
      summary_T = 'T: ' + trustworthiness.toFixed(2)
      // draw the summary
      var fontSize = 16
      context.font = 'italic' +  fontSize.toString() + 'px sans-serif';
      context.fillStyle = 'rgba(0,0,0,1)';
      context.fillText(summary_S, 0, 10);
      context.fillText(summary_T, 0, 30);
    };

    if (viewKind == 'main') {
      canvas.onmousedown = function(e) { 
        startCoords = mouseCoords(e, canvas);
        startCoords.x -= Math.floor(canvas.width / 2);
        startCoords.y = Math.floor(canvas.height / 2) - startCoords.y;
        clicked = true;
        // set cursor style to grabbing
        canvas.style.cursor = 'grabbing';
        if (!checkboxes.livesummary.checked) {
          // set metric subheader to ⏳
          document.getElementById('metric-subheader').innerHTML = '⏳';
        }
      };

      window.lastAngleH = 0;
      window.lastAngleV = 0;
      canvas.onmousemove = function(e) {
        if (!clicked) {
          return true;
        }

        var currCoords = mouseCoords(e, canvas);
        // if the mouse is outside the canvas, we will not update the rotation
        // and we will set the clicked variable to false
        tol = 5;
        if (currCoords.x <= tol || currCoords.x >= canvas.width-tol || currCoords.y <= tol || currCoords.y >= canvas.height-tol) {
          clicked = false;
          canvas.style.cursor = 'grab';
          return true;
        }
        currCoords.x -= Math.floor(canvas.width / 2);
        currCoords.y = Math.floor(canvas.height / 2) - currCoords.y;
        var motion = { 'x': currCoords.x - startCoords.x, 'y': currCoords.y - startCoords.y };
        var mouseSensitivity = document.getElementById('rot-speed').value / 100;
        // for the horizontal slider
        var sliderH = document.getElementById('handle-h');
        // check the current position of the slider
        var sliderHX = sliderH.offsetLeft;
        var sliderHPath = document.getElementById('track-h');
        var circleH = sliderHPath.getBoundingClientRect();
        var sliderHTravelX = mouseSensitivity * motion.x / bound;
        var angleDeltaH = sliderHTravelX * 2 * Math.PI;
        window.lastAngleH += angleDeltaH;
        // since it is a circle, we need to take the modulo 2*PI
        var lastAngleHDisplay = window.lastAngleH % (2 * Math.PI);
        // convert the angle to degrees
        lastAngleHDisplay = lastAngleHDisplay * 180 / Math.PI;
        // if it is negative, we need to add 360 to it
        if (lastAngleHDisplay < 0) {
          lastAngleHDisplay += 360;
        }
        // horizontal slider controls xy, xw, xz
        convAnglesH = shape.convertSlider(['xy', 'xw', 'xz'], lastAngleHDisplay);
        // mind that the rotation variables are in radians
        sliderRotations.xy = convAnglesH.xy * Math.PI / 180;
        sliderRotations.xw = convAnglesH.xw * Math.PI / 180;
        sliderRotations.xz = convAnglesH.xz * Math.PI / 180;
        // define the center of the slider track
        var centerHX = circleH.width / 2;
        var centerHY = circleH.height / 2;
        var correctionRadius = 7.5;
        var radiusH = sliderHPath.offsetWidth / 2 - correctionRadius;
        var sliderHX = centerHX + radiusH * Math.cos(window.lastAngleH);
        var sliderHY = centerHY + radiusH * Math.sin(window.lastAngleH);
        // move the slider handle alongside the track, rather than inside it
        var correctionSlider = -2.5;
        sliderH.style.left = sliderHX+correctionSlider + 'px';
        sliderH.style.top = sliderHY+correctionSlider + 'px';

        // for the vertical slider
        var sliderV = document.getElementById('handle-v');
        // check the current position of the slider
        var sliderVY = sliderV.offsetTop;
        var sliderVPath = document.getElementById('track-v');
        var circleV = sliderVPath.getBoundingClientRect();
        var sliderVTravelY = mouseSensitivity * motion.y / bound;
        var angleDeltaV = sliderVTravelY * 2 * Math.PI;
        window.lastAngleV += angleDeltaV;
        // since it is a circle, we need to take the modulo 2*PI
        var lastAngleVDisplay = window.lastAngleV % (2 * Math.PI);
        // convert the angle to degrees
        lastAngleVDisplay = lastAngleVDisplay * 180 / Math.PI;
        // if it is negative, we need to add 360 to it
        if (lastAngleVDisplay < 0) {
          lastAngleVDisplay += 360;
        }
        // vertical slider controls yz, yw, zw
        convAnglesV = shape.convertSlider(['yz', 'yw', 'zw'], lastAngleVDisplay);
        // mind that the rotation variables are in radians
        sliderRotations.yz = convAnglesV.yz * Math.PI / 180;
        sliderRotations.yw = convAnglesV.yw * Math.PI / 180;
        sliderRotations.zw = convAnglesV.zw * Math.PI / 180;
        // define the center of the slider track
        var centerVX = circleV.width / 2;
        var centerVY = circleV.height / 2;
        var radiusV = sliderVPath.offsetHeight / 2 - correctionRadius;
        var sliderVX = centerVX + radiusV * Math.cos(window.lastAngleV);
        var sliderVY = centerVY + radiusV * Math.sin(window.lastAngleV);
        // move the slider handle alongside the track, rather than inside it
        sliderV.style.left = sliderVX+correctionSlider + 'px';
        sliderV.style.top = sliderVY+correctionSlider + 'px';
        // update the display of the angles
        var mouseHAngle = lastAngleHDisplay + 90;
        var mouseVAngle = lastAngleVDisplay + 90;
        if (mouseHAngle > 360) {
          mouseHAngle -= 360;
        }
        if (mouseVAngle >= 360) {
          mouseVAngle -= 360;
        }
        document.getElementById('mouse-h-angle').innerHTML = Math.round(mouseHAngle) + '°';
        document.getElementById('mouse-v-angle').innerHTML = Math.round(mouseVAngle) + '°';

        // set the rotations
        shape.setSliderRotations();
        shape.rotate('xy', 0);
        startCoords = currCoords;

        window.draw();
      };

      canvas.onmouseup = function() {
        clicked = false;
        // set cursor style back to grab
        canvas.style.cursor = 'grab';
      };
    };

    if (viewKind == 'stress' || viewKind == 'trust') {
      canvas.onmousedown = (function(viewKind) {
        return function() {
          window.setView(viewKind, true);
        };
      })(viewKind);
    }

    checkboxes.onchange = function() {
      window.draw();
    };
  }

  /* End classes. */

  /* Begin methods. */

  // parse ascii files from http://paulbourke.net/geometry/hyperspace/
  Hypersolid.parseVEF = function(text) {
    var lines = text.split("\n");
    var nV = parseInt(lines[0]);  // number of vertices
    var nE = parseInt(lines[1+nV]);  // number of edges
    var nF = parseInt(lines[2+nV+nE]);  // number of faces
    var vertices = lines.slice(1,1+nV).map(function(line) {
      var d = line.split("\t").map(parseFloat);
      return {
        x: d[0],
        y: d[1],
        z: d[2],
        w: d[3],
      }
    });
    var edges = lines.slice(2+nV,2+nV+nE).map(function(line) {
      var d = line.replace("\s","").split("\t").map(function(vertex) { return parseInt(vertex); });
      return [d[0], d[1]];;
    });
    var faces = lines.slice(3+nV+nE,3+nV+nE+nF).map(function(line) {
      var d = line.replace("\s","").split("\t").map(function(edge) { return parseInt(edge); });
      return d;
    });
    return [vertices,edges,faces]
  };

  /* End methods. */

  /* Begin helper routines. */

  function mouseCoords(e, element) { // http://answers.oreilly.com/topic/1929-how-to-use-the-canvas-and-draw-elements-in-html5/
    var x;
    var y;
    if (e.pageX || e.pageY) { 
      x = e.pageX;
      y = e.pageY;
    }
    else { 
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; 
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop; 
    } 
    x -= element.offsetLeft;
    y -= element.offsetTop;
    return { 'x': x, 'y': y };
  }

  /* End helper routines. */

})(window.Hypersolid = window.Hypersolid || {});
