var svgMap = d3.select("body").select("svg");
var active = d3.select(null);
var g = svgMap.append("g").attr("id", "plot");
var map = g.append("g").attr("id", "map");
var tooltip = g.append("text").attr("id", "tooltip");
var details = g.append("foreignObject").attr("id", "details");
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

details.attr({
  "x": corner[0],
  "y": corner[1],
  "width": 400
}).style({
  "visibility": "hidden"
})
.append("xhtml:body")
.html("<p>N/A</p>");

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
  out.zipCode = +row["business_postal_code"];
  out.latitude = +row["business_latitude"];
  out.longitude = +row["business_longitude"];
  out.score = +row["inspection_score"];
  out.violation = row["violation_description"];
  out.riskCategory = row["risk_category"];

  // Remove those w/o coordinates + no score + zipcode != 0 + filter out schools
  if (out.longitude != "" && out.score != 0 && out.zipCode != 0 && out.name.indexOf("SCHOOL") == -1) {
    return out;
  }
}

function callback(error, rows) {
  if (error) throw error;

  var restaurantData = d3.nest()
      .key(function (d) { return d.name})
      .entries(rows);

  var scoreScale = d3.scale.quantile()
    .domain([0, 69, 70, 85, 86, 90, 91, 100])
    .range(["#d7191c", "#fdae61", "#a6d96a", "#1a9641"]);

  // console.log("Pre combination:");
  // console.table(restaurantData);

  // Congregate violations + risk categories into arrays, leave everything else the same
  restaurantData.forEach(function (d) {
      d.violations = [];
      d.riskCategories = [];
      d.avgScore = 0;

      d.location = [parseFloat(d.values[0].longitude), parseFloat(d.values[0].latitude)];

      d.zipCode = d.values[0].zipCode;
      d.address = d.values[0].address;

      d.values.forEach(function (c) {
          d.riskCategories.push(c.riskCategory);
          d.violations.push(c.violation);
          d.avgScore += c.score;
      })

      d.avgScore = d.avgScore / d.riskCategories.length;
  })

  symbols.selectAll("circle")
    .data(restaurantData)
    .enter()
    .append("circle")
    .attr("class", "symbol")
    .attr("id", function(d) {
      var colorVal = scoreScale(d.avgScore);
      var idCat = "cat";

      if (colorVal == "#d7191c") {
          idCat += "POOR"
      } else if (colorVal == "#fdae61") {
          idCat += "NEEDSIMPROVEMENT"
      } else if (colorVal == "#a6d96a") {
          idCat +="ADEQUATE"
      } else {
          idCat += "GOOD"
      }

      return idCat;
    })
    .attr("cx", function(d) { return projection(d.location)[0]})
    .attr("cy", function(d) { return projection(d.location)[1]})
    .attr("r", 5)
    .style("fill", function(d) { return scoreScale(d.avgScore); })
    .on("mouseover", function(d) {
      var me = d3.select(this);
      me.classed({"active": true});

      details.html("<p>" + d.key + "<br/>" + d.address + " - " + d.zipCode + "<br/>" + "Average Food Safety Score: " + d.avgScore.toFixed(2) + "</p>");

      details.style({"visibility": "visible"});

      this.parentNode.appendChild(this);
    })
    .on("mouseout", function(d) {
      var me = d3.select(this);
      me.classed({"active": false});
      details.style({"visibility": "hidden"});
    });

    // TODO: Fix bug: legend = undefined?
    // var legend = d3.legend.color()
    //     .labelFormat(d3.format(",.0f"))
    //     .cells(10)
    //     .scale(scoreScale);
    //
    // svgMap.append("g")
    //   .attr("class", "legendQuant")
    //   .attr("transform", translate(95, 150))
    //   .call(legend);
    //
    // svgMap.append("text")
    //   .attr("class", "legendTitle")
    //   .attr("transform", translate(0, 145))
    //   .text("Safety Score Categories");
    //
    // svgMap.append("text")
    //   .attr("class", "legendText")
    //   .attr("transform", translate(0, 161))
    //   .text("Poor");
    //
    // svgMap.append("text")
    //   .attr("class", "legendText")
    //   .attr("transform", translate(0, 178))
    //   .text("Needs Improvement");
    //
    // svgMap.append("text")
    //   .attr("class", "legendText")
    //   .attr("transform", translate(0, 195))
    //   .text("Adequate");
    //
    // svgMap.append("text")
    //   .attr("class", "legendText")
    //   .attr("transform", translate(0, 212))
    //   .text("Good");

    // Allows for filtering
    d3.selectAll("input").on("change", function() {
        var filter = "#" + this.value;

        if (this.checked) {
          d3.selectAll(filter).style({"visibility": "visible"});
        } else {
          d3.selectAll(filter).style({"visibility": "hidden"});
        }
    })


    $(".btn" ).click(function() {
        // DO BUTTON STUFF
        var checkboxes = d3.selectAll("input");

        for (var i = 0; i < checkboxes[0].length; i++) {
            checkboxes[0][i].checked = true;
        }

        d3.selectAll(".symbol").style({"visibility": "visible"});
    })
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
