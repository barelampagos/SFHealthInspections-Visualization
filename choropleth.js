var svgMap = d3.select("body").select("svg");
var active = d3.select(null);
var g = svgMap.append("g").attr("id", "plot");
var map = g.append("g").attr("id", "map");
var tooltip = g.append("text").attr("id", "tooltip");
var symbols = g.append("g").attr("id", "symbols");
var projection = d3.geo.conicEqualArea();
var path = d3.geo.path().projection(projection);

projection.center([-122.419416, 37.774929]);
projection.parallels([37.692514, 37.840699]);
projection.rotate([122, 0]);
projection.scale(350000);

var center = projection(projection.center());
var translate = function(x, y) { return "translate(" + x + "," + y + ")"; };

tooltip.attr({
  "x": center[0],
  "y": center[1],
  "text-anchor": "end",
  "dx": -5,
  "dy": -5
}).style({
  "visibility": "hidden"
})
.text("N/A");

var corner = projection([-122.511120, 37.824430]);

d3.json("SFZipCodes4326.geojson", function(error, json) {
  if (error) throw error;

  // console.log("Zip Codes", json);

  map.selectAll("path")
    .data(json.features, function (d) {
      return d.properties.zip_code;
    })
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "zipArea");

  // Call upon arcane magic to resize
  arcaneMagic.resize(svgMap, g, 0);

  d3.csv("Food_Inspections_-_LIVES_Standard.csv", accessor, callback);
});

function accessor(row) {
  var out = {};
  out.name = row["business_name"];
  out.address = row["business_address"];
  out.zip = +row["business_postal_code"];
  out.zipCode = "ZIP" + row["business_postal_code"];
  out.score = +row["inspection_score"];
  out.violation = row["violation_description"];
  out.riskCategory = row["risk_category"];

  // Remove those w/o coordinates + no score + zipcode != 0 + filter out schools
  if (out.zipCode != "ZIP00000" && out.score != 0 && out.zipCode != "ZIP" && out.name.indexOf("SCHOOL") == -1) {
    return out;
  }
}

function callback(error, rows) {
  if (error) throw error;

  // console.log(rows);

  var zipData = d3.nest()
      .key(function (d) { return d.zipCode})
      .key(function (d) { return d.name})
      .entries(rows);

  // console.log(zipData);

  var scoreScale = d3.scale.quantile()
    .domain([0, 69, 70, 85, 86, 90, 91, 100])
    .range(["#d7191c", "#fdae61", "#a6d96a", "#1a9641"]);

  var color = d3.scale.ordinal()
      .domain(["Poor", "Needs Improvement", "Adequate", "Good"])
      .range(["#d7191c", "#fdae61", "#a6d96a", "#1a9641"]);
  //
  // console.log("Pre combination:");
  // console.table(zipData);

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

  console.table(zipData);

  var choropleth = d3.scale.linear()
    .domain([0, d3.max(zipData, function(d) { return d.Good; })])
    .range(["#deebf7", "#3182bd"])
    .interpolate(d3.interpolateHcl);

  map.selectAll("path")
    .style("fill", function(d) {
      var zipKey = "ZIP" + d.properties["zip"];

      var zipValue = findObject(zipData, zipKey).Good;

      if (zipValue == null) {
        return choropleth(0);
      } else {
        return choropleth(zipValue);
      }
    });

  // Create Legend
  var percentScale = d3.scale.linear()
    .domain(d3.extent(choropleth.domain()))
    .rangeRound([0, 100]);

  svgMap.append("defs")
    .append("linearGradient")
    .attr("id", "gradient")
    .selectAll("stop")
    .data(choropleth.domain())
    .enter()
    .append("stop")
    .attr("offset", function(d) {
      return "" + percentScale(d) + "%";
    })
    .attr("stop-color", function(d) {
      return choropleth(d);
    });

  var legend = svgMap.append("g")
    .attr("id", "legend");

  legend.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 200)
    .attr("height", 15)
    .attr("fill", "url(#gradient)");

  var legendScale = d3.scale.linear()
    .domain(percentScale.domain())
    .range([0, 200]);

  var legendAxis = d3.svg.axis()
    .scale(legendScale)
    .orient("bottom")
    .innerTickSize(4)
    .outerTickSize(4)
    .tickPadding(4)
    .tickValues(choropleth.domain());

  legend.append("g")
    .attr("id", "color-axis")
    .attr("class", "legend")
    .attr("transform", translate(0, 15))
    .call(legendAxis);

  legend.attr("transform", translate(400, 10));

  d3.selectAll("input").on("change", function() {
    var filter = this.value;
    var axis = d3.select("#color-axis");

    choropleth.domain([0, d3.max(zipData, function(d) { return d[filter]; })]);

    map.selectAll("path").style("fill", function(d) {
      var zipKey = "ZIP" + d.properties["zip"];
      var zipValue = findObject(zipData, zipKey)[filter];

      if (zipValue == null) {
        return choropleth(0);
      } else {
        return choropleth(zipValue);
      }
		});

    // Reset axis scales
    var percentScale = d3.scale.linear()
    .domain(d3.extent(choropleth.domain()))
    .rangeRound([0, 100]);

    var legendScale = d3.scale.linear()
      .domain(percentScale.domain())
      .range([0, 200]);

    var legendAxis = d3.svg.axis()
      .scale(legendScale)
      .orient("bottom")
      .innerTickSize(4)
      .outerTickSize(4)
      .tickPadding(4)
      .tickValues(choropleth.domain());

    axis.call(legendAxis);
  });

  map.selectAll("path")
  .on("mouseover", function(d) {
    var me = d3.select(this);
    me.classed({"active": true});

    var filter = d3.select("input:checked")[0][0].value;
    var zipKey = "ZIP" + d.properties["zip"];
    var zipValue = findObject(zipData, zipKey);


    tooltip.text(d.properties.zip + ": " + zipValue[filter] + " '" + filter + "' restaurants(s)");

    tooltip.style({"visibility": "visible"});

    this.parentNode.appendChild(this);
  })
  .on("mousemove", function(d) {
    // get coordinates according to "plot" group
    var coords = d3.mouse(g.node());

    if (coords[0] < 434411) {
      tooltip.attr({"x": coords[0] + 220, "y": coords[1]});
    } else {
      tooltip.attr({"x": coords[0], "y": coords[1]});
    }
  })
  .on("mouseout", function(d) {
    var me = d3.select(this);
    me.classed({"active": false});
    tooltip.style({"visibility": "hidden"});
  });



}

var findObject = function(array, key) {
  for (var i = 0; i < array.length; i++) {
      if (array[i].key === key) {
        return array[i];
      }
  }
}

// Other
var arcaneMagic = (function() {

  var main = {};

  main.resize = function(svg, plot, padding) {
    // http://stackoverflow.com/questions/23560038/
    var bbox = plot.node().getBBox();
    var view = [bbox.x, bbox.y, bbox.width, bbox.height];

    var x = -bbox.x + (padding / 2.0);
    var y = -bbox.y + (padding / 2.0);

    svg.attr("width",  bbox.width  + padding);
    svg.attr("height", bbox.height + padding);

    plot.attr("viewBox", view.join(" "));
    plot.attr("transform", "translate(" + x + ", " + y + ")");

    view = [0, 0, bbox.width + padding, bbox.height + padding];
    svg.attr("viewBox", view.join(" "));
    svg.attr("version", "1.1");
    svg.attr("xmlns", "http://www.w3.org/2000/svg");
    svg.attr("preserveAspectRatio", "xMinYMin meet");
  };

  return main;
})();
