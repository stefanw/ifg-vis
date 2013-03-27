(function(){

  var margin = {top: 20, right: 20, bottom: 20, left: 20};
  var innerX = {top: 0, right: 50, bottom: 30, left: 80};
  var innerY = {top: 30, right: 80, bottom: 50, left: 30};

  d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this);
    });
  };

  var containerWidth = document.getElementById('vis').offsetWidth;

  var width = Math.max(containerWidth, 768) - margin.left - margin.right,
      height = 468 - margin.top - margin.bottom;

  var parseYear = d3.time.format("%Y").parse;


  var innerXWidth = width - innerX.right - innerX.left;
  var x = d3.time.scale()
      .range([0, innerXWidth]);

  var innerYHeight = height - innerY.top - innerY.bottom;
  var y = d3.scale.linear()
      .domain([0, 100])
      .range([innerYHeight, 0]);

  var yAxis = d3.svg.axis()
      .scale(y)
      .tickSize(-width, 0, 0)
      .ticks(5)
      .tickFormat(function(d){ return d + '%'; })
      .orient("left");

  var xAxis = d3.svg.axis()
      .scale(x)
      .tickSize(-height + innerY.bottom, 0, 0)
      .tickPadding(6)
      .orient("top");

  var circleRadius = d3.scale.sqrt()
      .rangeRound([1, IFGVis.maxDotSize]);

  var connectionLine = d3.svg.line()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; })
    .interpolate("basis")
    .defined(function(d){
      return d.defined;
    });


  var svg = d3.select("#vis").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("g")
    .attr("class", "y axis")
    .attr('transform', 'translate(' + innerY.left + ',' + innerY.top + ')')
    .call(yAxis);

  svg.select('.y.axis .major line').classed('bottomline', true);

  var activeGroups = 0;

  var activateGroup = function(key, hover) {
    return function(){
      var obj = groups[key];
      obj.group.moveToFront();
      svg.selectAll("." + key).style("fill", IFGVis.colors[key]).classed('active', true);
      obj.group.select('.line').style('display', 'inline');
      if (stack[stack.length - 1] === key) {
        svg.select('#label').moveToFront()
          .text(IFGVis.labels[key])
          .style('fill', IFGVis.colors[key])
          .attr('transform', 'translate(' + (innerXWidth + innerX.left) + ',' + obj.labelpos + ')');
        obj.group.selectAll('.circle-number').style('display', 'inline');
      } else {
        obj.group.selectAll('.circle-number').style('display', 'none');
      }
    };
  };

  var permanentlyActivateGroup = function(key){
    return function(){
      var obj = groups[key];
      obj.isActive = !obj.isActive;
      if (obj.isActive) {
        activateGroup(key)();
      } else {
        deactivateGroup(key)();
      }
    };
  };

  var deactivateGroup = function(key) {
    return function() {
      var obj = groups[key];
      if (obj.isActive) { return; }
      obj.group.select('.line').style('display', 'none');
      obj.group.selectAll(".dot").style("fill", "").classed('active', false);
      obj.group.selectAll('.circle-number').style('display', 'none');
      refreshAllActiveGroups();
    };
  };

  var refreshAllActiveGroups = function(){
    for (var key in groups){
      if (groups[key].isActive){
        activateGroup(key)();
      }
    }
    if (stack.length > 0) {
      groups[stack[stack.length - 1]].group.moveToFront();
    }
    svg.select('#label').moveToFront();
  };

  var groups = {};

  var getLineData = function(groupData){
    var newData = [], d, rad, dist;
    for (var i = 0; i < groupData.length; i += 1){
      if (i < groupData.length - 1) {
        dist = x(groupData[1].year) - x(groupData[0].year);
        dist = Math.round((dist - 50) / 2);
      }
      rad = dist;
      if (i > 0){
        d = $.extend({}, groupData[i]);
        d.rad = rad;
        d.x = x(d.year) - rad;
        d.y = y(d.transparency);
        d.defined = true;
        newData.push(d);
      }
      d = $.extend({}, groupData[i]);
      d.x = x(d.year);
      d.y = y(d.transparency);
      d.defined = true;
      newData.push(d);
      if (i < groupData.length - 1) {
        d = $.extend({}, groupData[i]);
        d.x = x(d.year) + rad;
        d.y = y(d.transparency);
        d.defined = true;
        newData.push(d);
      }
    }

    return newData;
  };

  var makeGroup = function(key, groupData){
    var group = svg.append('g')
      .attr('transform', 'translate(' + innerX.left + ',' + innerY.top + ')')
      .attr('class', 'group ' + key);

    var connectionData = getLineData(groupData);

    group.append("svg:path")
        .attr('class', 'line')
        .style('stroke', IFGVis.colors[key])
        .style('display', 'none')
        .attr("d", connectionLine(connectionData));

    var groupSelect = group
      .selectAll("." + key)
      .data(groupData);

    var circleGroup = groupSelect
      .enter().append("g");
    circleGroup
      .append('circle')
      .attr("class", "dot " + key)
      .attr("r", function(d) {
        return circleRadius(d.count);
      })
      .attr("cx", function(d) { return x(d.year); })
      .attr("cy", function(d) { return y(d.transparency); });

    groupSelect.filter(function(d, i){
      return circleRadius(d.count) <= IFGVis.dotSizeNeedsHelp;
    }).append('circle')
      .attr("r", IFGVis.helpDotSize)
      .attr("class", "helpdot")
      .attr("cx", function(d) { return x(d.year); })
      .attr("cy", function(d) { return y(d.transparency); });

    circleGroup.append('text')
      .attr('class', 'circle-number')
      .style('fill', IFGVis.colors[key])
      .attr('transform', function(d){
        return 'translate(' + (x(d.year) + 2) + ',' + (y(d.transparency) - (circleRadius(d.count)) - 10) + ')';
      })
      .style('display', 'none')
      .attr('text-anchor', 'middle')
      .text(function(d){
          return d.transparency + '% bewilligt';
      });

    var t = circleGroup.append('text')
      .attr('class', 'circle-number')
      .style('fill', IFGVis.colors[key])
      .attr('transform', function(d){
        return 'translate(' + (x(d.year)) + ',' + (y(d.transparency) + (circleRadius(d.count)) + 20) + ')';
      })
      .style('display', 'none')
      .attr('text-anchor', 'middle');
    t.append('tspan')
      .attr('x', 0)
      .text(function(d){
          return d.count + (d.count <= 1000 ? ' Anträge' : '');
      });
    t.append('tspan')
      .attr('x', 0)
      .attr('dy', 15)
      .text(function(d){
        return d.count > 1000 ? 'Anträge' : '';
      });


    group.data(groupData)
      .on("mouseover", activateGroup(key, true))
      // .on("mousemove", activateGroup(key, true))
      .on("mouseout", deactivateGroup(key))
      .on("touch", navigateToKey(key))
      .on("click", navigateToKey(key));

    var lastBubble = groupData[groupData.length - 1];
    var labelpos = y(lastBubble.transparency) - circleRadius(lastBubble.count) + 5;

    return {
      labelpos: labelpos,
      group: group,
      isActive: false
    };
  };

  var dataLoaded = function(error, data) {
    data.forEach(function(d) {
      d.year = parseYear(d.year);
      d.count = parseInt(d.count, 10);
      d.transparency = parseInt(d.transparency, 10);
    });
    data = data.filter(function(d){
      return d.count > 0;
    })
    .sort(function(a, b){
      return a.year - b.year;
    });

    x.domain(d3.extent(data, function(d) { return d.year; }));
    svg.append("g")
      .attr("class", "x axis")
      .attr('transform', 'translate(' + innerX.left + ',' + innerX.top + ')')
      .call(xAxis);


    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('transform', 'translate(' + (innerXWidth) + ',' + (innerY.top) + ')')
      .attr('id', 'label');

    circleRadius.domain(d3.extent(data, function(d) { return d.count; }));

    var filterFunc = function(key){
      return function(d){ return d.name === key; };
    };

    for (var key in IFGVis.colors) {
      groups[key] = makeGroup(key, data.filter(filterFunc(key)));
    }

    init();
  };

  var initial = true, stack = [];

  var WorkspaceRouter = Backbone.Router.extend({
    routes: {
      "*args": "show"
    },

    home: function(){

    },

    show: function(args) {
      if (initial && args === "") {
        router.navigate(IFGVis.defaultInstitution, {trigger: true});
        initial = false;
        return;
      }
      initial = false;
      args = args.split('&');
      $('#label').text('');
      $('input').prop('checked', false);
      for (var key in groups){
        groups[key].isActive = false;
        deactivateGroup(key)();
      }
      activeGroups = 0;
      stack = [];
      for (var i = 0; i < args.length; i += 1) {
        if (groups[args[i]] !== undefined) {
          stack.push(args[i]);
          $('input[value="' + args[i] + '"]').prop('checked', true);
          activeGroups += 1;
          permanentlyActivateGroup(args[i])();
        }
      }
      refreshAllActiveGroups();
    }

  });

  var init = function(){
    Backbone.history.start();
  };

  var router = new WorkspaceRouter();

  var navigateToKey = function(key){
    return function(){
      var checked = $('input[value="' + key + '"]').prop('checked');
      $('input[value="' + key + '"]').prop('checked', !checked);
      toggleOnStack(key, !checked);
      updateNav();
    };
  };

  var toggleOnStack = function(key, add){
    if (add) {
      stack.push(key);
    } else {
      stack = stack.filter(function(el){
        return el !== key;
      });
    }
  };

  var updateNav = function(){
    router.navigate(stack.join('&'), {trigger: true});
  };

  $(function(){
    $('#auswahl-button').on('click touchstart', function(e){
      e.preventDefault();
      $('#auswahl').slideToggle();
    });
    $('#choose-all').on('click touchstart', function(e){
      e.preventDefault();
      $('.auswahl-liste input').prop('checked', true);
      stack = [];
      $('.auswahl-liste input').each(function(i, el){
        stack.push($(el).val());
      });
      updateNav();
    });
    $('#choose-none').on('click touchstart', function(e){
      e.preventDefault();
      $('.auswahl-liste input').prop('checked', false);
      stack = [];
      updateNav();
    });
    $('.auswahl-liste input').change(function(e){
      toggleOnStack($(this).val(), $(this).prop('checked'));
      updateNav();
    });
    $('.close').on('click touchstart', function(e){
      e.preventDefault();
      $('#auswahl').slideUp();
    });
  });

  dataLoaded(null, IFGVis.data);
  // d3.csv("data.csv", dataLoaded);

}());
