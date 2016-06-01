var margin = {top: 20, right: 20, bottom: 50, left: 80},
    plotWidth = 1000 - margin.left - margin.right,
    plotHeight = 700 - margin.top - margin.bottom;

// Helper function for translation
var translate = function(x, y) {
  return "translate(" + String(x) + ", " + String(y) + ")";
};

var x = d3.scale.linear()
    .rangeRound([0, plotWidth]);

var y = d3.scale.ordinal()
    .rangeRoundBands([plotHeight, 0], .1);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

// var color = d3.scale.ordinal()
//     .range(["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#2A3B6F", "#ff7f00"]);

var svg = d3.select("body").select("svg")
    .attr("width", plotWidth + margin.left + margin.right)
    .attr("height", plotHeight + margin.top + margin.bottom)
  .append("g")
    .attr("transform", translate(margin.left, margin.top));

// Load csv file
d3.csv("Food_Inspections_-_LIVES_Standard.csv", accessor, callback);

function accessor(row) {
  var out = {};
  out.name = row["business_name"];
  out.address = row["business_address"];
  out.zipCode = row["business_postal_code"];

  out.score = +row["inspection_score"];
  out.violation = row["violation_description"];
  out.riskCategory = row["risk_category"];

  // Remove those w/o valid zipcode + no score + zipcode != 0 + filter out schools
  if (out.zipCode !="CA" && out.zipCode != "941033148" && out.score != 0 && out.zipCode != 0 && out.name.indexOf("SCHOOL") == -1) {
    return out;
  }
}

function callback(error, rows) {
  if (error) throw error;

  console.log(rows);

  var zipData = d3.nest()
      .key(function (d) { return d.zipCode})
      .key(function (d) { return d.name})
      .entries(rows);

  console.log(zipData);

  var scoreScale = d3.scale.quantile()
    .domain([0, 69, 70, 85, 86, 90, 91, 100])
    .range(["#d7191c", "#fdae61", "#a6d96a", "#1a9641"]);

  var color = d3.scale.ordinal()
      .domain(["Poor", "Needs Improvement", "Adequate", "Good"])
      .range(["#d7191c", "#fdae61", "#a6d96a", "#1a9641"]);

  console.log("Pre combination:");
  console.table(zipData);

  // Congregate violations + risk categories into arrays, leave everything else the same
  zipData.forEach(function (d) {
      d.values.forEach(function (b) {
        b.avgScore = 0;
        b.riskCategories = [];

        b.values.forEach(function (c) {
          b.riskCategories.push(c.riskCategory);
          b.avgScore += c.score;
        })

        b.avgScore = b.avgScore / b.riskCategories.length;
      })
  })

  zipData.forEach(function (d) {
      d.total = 0;
      d.Poor = 0;
      d["Needs Improvement"] = 0;
      d.Adequate = 0;
      d.Good = 0;

      d.values.forEach(function (c) {
        var colorVal = scoreScale(c.avgScore);

        if (colorVal == "#d7191c") {
            d.Poor++;
        } else if (colorVal == "#fdae61") {
            d["Needs Improvement"]++;
        } else if (colorVal == "#a6d96a") {
            d.Adequate++;
        } else {
            d.Good++;
        }
        d.total++;
      })
  })

  // Filter out zipcodes w/ less than 10 restaurants
  zipData = zipData.filter(function(d) { return d.total > 10; });
  zipData.sort(function(a, b) { return b.total - a.total; });


  console.log("Post combination:");
  console.table(zipData);

  console.log(color.domain());

  zipData.forEach(function(d) {
    var x0 = 0;
    d.categories = color.domain().map(function(c) {
      return {category: c, x0: x0, x1: x0 += d[c]};
    });
  });

  console.log(zipData);

  x.domain([0, d3.max(zipData, function(d) { return d.total; })]);
  y.domain(zipData.map(function (d) { return d.key }) );

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", translate(0, plotHeight))
      .call(xAxis)
      .append("text")
        .attr("x", 423)
        .attr("y", 20)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .attr("id", "header")
        .text("Restaurant Amount");

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("x", 15)
      .attr("y", -10)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .attr("id", "header")
      .text("SF Zip Code");

  var bars = svg.selectAll(".bars")
      .data(zipData)
    .enter().append("g")
      .attr("class", "g")
      .attr("transform", function(d) { return translate(0, y(d.key)); });

  var tooltip = svg.append("text").attr("id", "tooltip");

  tooltip.attr({
    "x": 50,
    "y": 50,
    "text-anchor": "end",
    "dx": 5,
    "dy": -20
  }).style({
    "visibility": "hidden"
  })
  .text("N/A");

  bars.selectAll("rect")
      .data(function(d) { return d.categories; })
    .enter().append("rect")
      .attr("height", y.rangeBand())
      .attr("x", function(d) { return x(d.x0); })
      .attr("width", function(d) { return x(d.x1) - x(d.x0); })
      .style("fill", function(d) { return color(d.category); })
      .on("mouseover", function(d) {
        var me = d3.select(this);
        me.classed({"active": true});

        // console.log(me[0][0]["__data__"].x1 - );

        var amount = me[0][0]["__data__"].x1 - me[0][0]["__data__"].x0;

        tooltip.text(amount + " '" + me[0][0]["__data__"].category +  "' Restaurant(s)");
        tooltip.style({"visibility": "visible"});

        // move selected path to front
        this.parentNode.appendChild(this);
      })
      .on("mousemove", function(d) {
        // get coordinates according to "plot" group
        var coords = d3.mouse(svg.node());
        if (coords[0] < 200) {
          tooltip.attr({"x": coords[0] + 150, "y": coords[1]});
        } else {
          tooltip.attr({"x": coords[0], "y": coords[1]});
        }
        // tooltip.attr({"x": coords[0], "y": coords[1]});
      })
      .on("mouseout", function(d) {
        var me = d3.select(this);
        me.classed({"active": false});
        tooltip.style({"visibility": "hidden"});
      });

  var legend = svg.selectAll(".legend")
      .data(color.domain().slice().reverse())
    .enter().append("g")
      .attr("class", "legend")
      .attr("transform", function(d, i) { return translate(0, i * 20);
      });

  legend.append("rect")
      .attr("x", plotWidth - 18)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", color);

  legend.append("text")
      .attr("x", plotWidth - 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("text-anchor", "end")
      .text(function(d) { return d; });
}
