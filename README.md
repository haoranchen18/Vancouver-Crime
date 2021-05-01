# Description

### Overview

With the constant developments taking place in Vancouver, crime rates and their patterns have been changing over the last few years. If we could understand how these patterns have changed in the past, then we could gain insight into patterns of crime that could occur in the future. This could be especially useful for those who are exploring neighborhoods when purchasing property, or those who want to determine if their office would be safer to take public transit to rather than car or bicycle given a high-theft area. To address this challenge, we propose a data visualization that allows current or prospective Vancouver residents to visually explore a dataset of crimes in Vancouver from 2003 to 2017. Our app shows the overall crime trend in Vancouver, as well as common types of crime that occur. Users are able to filter crimes based on a selected year range, and see how their distributions differ across distinct regions in Vancouver. In addition, information on which neighborhoods rank the highest in a category of crime, depending on time of day and broken down by blocks within each neighborhood, is easy to see with our visualization.



### Data

The dataset can be accessed via or https://www.kaggle.com/wosaku/crime-in-vancouver. It contains two csv files, but we will only be using ‘crime.csv’. 


### Visualization

Our visualization was developed and optimized for a minimum screen width of 1600px.Our visualization consists of 4 different views: stacked area chart, donut chart, bubble chart (appears on user click input from donut chart), and dot density map. There are also 2 different types of widgets: an area chart with brushing action (technically defined as an allowable widget for the purposes of this project as specified in M2 and M3: serves as the context view, while the stacked area chart serves as its focus view), and time of day check boxes for the bubble chart. The stacked area chart allows the user to see trends of crime over time, by each aggregated category of crime. There is also a dropdown menu to select whether this view should show relative levels of crime (%) or absolute counts of crime (as a magnitude of 1000). The brush filter shows the overall crime trend over time, and drives all of the other views by filtering the data by year. The donut chart allows the user to see relative proportions of the aggregated crime categories for a selected year range. This view also drives the stacked area chart and bubble chart by filtering each of these views by the selected type of crime. The bubble chart allows users to view the 5 neighborhoods with the most crime of a selected category. WIthin a category of crime, users can also see how the ordering of these high crime neighborhoods changes when filtering for crimes that occurred during the day or during the evening, by using the chart’s labelled check boxes. Finally, the dot density map allows the user to see how crime is distributed over the city of Vancouver, which helps them to identify areas that are hot spots for crime in an immediately visual way through identifying clusters of dots.


### Credits

This is a group project. There are three people in our team. Thank so much for our teammates'(HC, YZ, MW) great contribution. 

### URL
https://haoranchen18.github.io/Vancouver-Crime/