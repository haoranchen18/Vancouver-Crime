// Initialize helper function to convert date strings to date objects
const parseTime = d3.timeParse("%Y-%m-%d");

// Global objects
let data, bubbleCrimeData, bubbleBrushedYearData, stackedAreaChart, timeline, donutChart, dotDensityMap, bubbleChart;
let crimeTypeFilter = [];
let yearBrushDomain = [];
let isRelative = false;
let isBrushed = false;
let activeCrime = ""; // to add to donut chart class for selected crime type to filter by

async function loadingFunction() {
    const loaded = await loadData();

    if (loaded === "loaded") {
        showViews();
    }
}

function showViews() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("myDiv").style.visibility = "visible";
}

/**
 * Load data from CSV file asynchronously and render charts
 */
function loadData() {
    return new Promise((res, rej) => {
        d3.csv('data/crime.csv').then(_data => {
            data = _data;
            // Do data transform to create new variables
            data.forEach(d => {
                // Convert hour and minute to numerical values
                d.HOUR = +d.HOUR;
                d.MINUTE = +d.MINUTE;
        
                // Set parsed date object property for each item
                let dateString = d.YEAR + "-" + d.MONTH + "-" + d.DAY;
                d.date = parseTime(dateString);
        
                d.YEAR = +d.YEAR;
                d.MONTH = +d.MONTH;
                d.DAY = +d.DAY;
        
                // Set derived (aggregated) category of crime property based on given
                if (d.TYPE === 'Theft from Vehicle' || d.TYPE === 'Theft of Bicycle' || d.TYPE === 'Theft of Vehicle' ||
                    d.TYPE === 'Other Theft') {
                    d.typeGeneral = 'theft';
                } else if (d.TYPE === 'Mischief') {
                    d.typeGeneral = 'mischief';
                } else if (d.TYPE === 'Break and Enter Commercial' || d.TYPE === 'Break and Enter Residential/Other') {
                    d.typeGeneral = 'break-in';
                } else if (d.TYPE === 'Vehicle Collision or Pedestrian Struck (with Injury)' ||
                    d.TYPE === 'Vehicle Collision or Pedestrian Struck (with Fatality)') {
                    d.typeGeneral = 'vehicle-accident';
                } else {
                    // this aggregates 'Offence Against a Person' and 'Homicide' crime types
                    d.typeGeneral = 'offence';
                }
        
                // Set boolean flags or null for nightTime
                let dayTimeRange = [6*60, 17*60+59];
        
                if (isNaN(parseInt(d.HOUR)) || isNaN(parseInt(d.MINUTE))) {
                    d.nightTime = null;
                } else {
                    let num = parseInt(d.HOUR) * 60 + parseInt(d.MINUTE);
                    d.nightTime = dayTimeRange[0] <= num && num <= dayTimeRange[1] ? false : true;
                }
            });
        
            // Initialize bubble chart data to be set to all data (later will be set to filtered data by crime)
            bubbleCrimeData = data;
            bubbleBrushedYearData = data;
        
            // Initialize DotDensityMap
            dotDensityMap = new DotDensityMap(data);
            dotDensityMap.drawCircleOnMap(data);
        
            // Initialize bubble chart
            bubbleChart = new BubbleChart({ parentElement: '#bubblechart' }, bubbleCrimeData);
        
            // Stacked area chart: pass in year input domain to prevent yAxis re-scaling on data filtering
            const yearRange = d3.extent(data, d => d.YEAR);
        
            // Initialize stacked area chart and render
            stackedAreaChart = new StackedAreaChart({ parentElement: '#stacked-area-chart', xDomain: yearRange }, data);
        
            // Initialize brush timeline and render
            timeline = new Timeline({ parentElement: '#brush-timeline', xDomain: yearRange}, data);
        
            // Initialize donut chart and render
            donutChart = new DonutChart({ parentElement: '#donut-chart' }, data);
        
            // Call updateVis after views have rendered and not at the end of timeline's initVis method
            // to avoid brush render async issue
            // If not, then brush will be undefined
            timeline.updateVis();
            res('loaded');
        })
        .catch(error => {
            rej(error);
            console.error(error);
        });
    })
}


// Listen to events and update views

/**
 * Select box event listener
 */
d3.select('#display-type-selection').on('change', function() {
    isBrushed = false;
    // Reset data for stacked area chart to be total (unfiltered) data
    stackedAreaChart.data = data;
    // empty pie chart filter selection when changing chart view
    crimeTypeFilter = [];
    activeCrime = "";

    // Get selected display type and update chart
    stackedAreaChart.config.displayType = d3.select(this).property('value');
    // Update global boolean flag for display type
    isRelative = !isRelative;

    // Hide bubble chart when switch to relative display since it shows all categories by design
    if (isRelative) {
        d3.select('.bubbleChart-container')
            .style('display', 'none');
    }

    // Update charts
    donutChart.updateVis();
    stackedAreaChart.updateVis();
});

/**
 * Listener for day time toggle
*/
d3.select("#checkbox-daytime").on('change', () => {
    let value = d3.select("#checkbox-daytime").property("checked");
    bubbleChart.config.dayTime = value;
    bubbleChart.updateVis();
});

/**
 * Listener for night time toggle
*/
d3.select("#checkbox-nighttime").on('change', () => {
    let value = d3.select("#checkbox-nighttime").property("checked");
    bubbleChart.config.nightTime = value;
    bubbleChart.updateVis();
});

/**
 * React to brush events
 */
function brushed(selection) {
    // Check if the brush is still active or if it has been removed
    if (selection) {
        // Convert given pixel coordinates (range: [x0,x1]) into a time period (domain: [Year, Year])
        const selectedDomain = selection.map(timeline.xScale.invert, timeline.xScale);

        // Floor the numbers so that years are integers
        selectedDomain[0] = Math.floor(selectedDomain[0]);
        selectedDomain[1] = Math.ceil(selectedDomain[1]);

        // Update global year selection domain
        yearBrushDomain = selectedDomain;

        // Move brush selection to snap to selected domain values (floor and ceiling of min and max, respectively)
        // This signals to users the level of granularity in the data that we are using to filter by
        const timelineRange = selectedDomain.map(d => timeline.xScale(d));
        d3.select('.brush-context').call(timeline.brush.move, timelineRange);

        // Update x-scale of the focus view accordingly
        stackedAreaChart.xScale.domain(selectedDomain);

        // Filter data by year to update donut chart by selection
        const brushedData = data.filter(d => d.YEAR <= selectedDomain[1] && d.YEAR >= selectedDomain[0]);
        donutChart.data = brushedData;

        // Update the map based on brushed data
        dotDensityMap.drawCircleOnMap(brushedData);

        // Filter bubble chart data by year (only shows one crime type)
        bubbleBrushedYearData =
            bubbleCrimeData.filter(d => d.YEAR <= selectedDomain[1] && d.YEAR >= selectedDomain[0]);
        bubbleChart.data = bubbleBrushedYearData;
    } else {
        // Reset global year brush domain
        yearBrushDomain = [];

        // Reset the map data to total
        dotDensityMap.drawCircleOnMap(data);

        // Reset x-scale of the focus view (full time period)
        stackedAreaChart.xScale.domain(timeline.xScale.domain());
        donutChart.data = data;
        bubbleChart.data = bubbleCrimeData;
    }

    // Redraw line and update x-axis labels in focus view
    stackedAreaChart.focusAreas.transition().duration(700).attr('d', stackedAreaChart.area);
    stackedAreaChart.xAxisG.call(stackedAreaChart.xAxis);

    // Update donut chart and bubble chart to show filter by year
    donutChart.updateVis();
    bubbleChart.updateVis();
}

/**
 * Use donut chart as filter and update stacked area chart to show only selected crime type
 * One crime category can only be selected at a time to filter stacked area chart by
 */
function crimeTypeFilterData() {
    isBrushed = false;
    // Check if crime type has been selected
    if (crimeTypeFilter.length === 0) {
        // Reset stacked area chart to total data if no crime selected (crime filter empty)
        stackedAreaChart.data = data;
        bubbleChart.data = bubbleCrimeData;
    } else {
        // Filter temp data according to selected crime type and set stacked area chart's data to it and re-render
        const selectedCrimeData = data.filter(d => crimeTypeFilter.includes(d.typeGeneral));
        // set bubble chart data to this crime category
        stackedAreaChart.data = selectedCrimeData;
        bubbleCrimeData = selectedCrimeData;
        // Check if brush selection made at the time of crime type and update data
        if (yearBrushDomain.length === 0) {
            bubbleBrushedYearData = selectedCrimeData;
            bubbleChart.data = bubbleBrushedYearData;
        } else {
            bubbleBrushedYearData = bubbleCrimeData.filter(d =>
                d.YEAR < yearBrushDomain[1] && d.YEAR > yearBrushDomain[0]);
            bubbleChart.data = bubbleBrushedYearData;
        }
    }
    stackedAreaChart.updateVis();
    donutChart.updateVis();
    bubbleChart.updateVis();
}

