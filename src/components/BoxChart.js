/**
 *  Copyright (c) 2015-present, The Regents of the University of California,
 *  through Lawrence Berkeley National Laboratory (subject to receipt
 *  of any required approvals from the U.S. Dept. of Energy).
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import _ from 'underscore';
import merge from 'merge';
import React from 'react';
import {
  TimeSeries,
  IndexedEvent,
  TimeRangeEvent,
  Event,
  min,
  max,
  percentile,
  median,
} from 'pondjs';

// import EventMarker from './EventMarker';
import { Styler } from '../js/styler';
import { scaleAsString } from '../js/util';

const defaultFillStyle = {
  fill: 'steelblue',
  stroke: 'none',
};

const defaultStyle = [
  {
    normal: { ...defaultFillStyle, opacity: 0.2 },
    highlighted: { ...defaultFillStyle, opacity: 0.3 },
    selected: { ...defaultFillStyle, opacity: 0.3 },
    muted: { ...defaultFillStyle, opacity: 0.1 },
  },
  {
    normal: { ...defaultFillStyle, opacity: 0.5 },
    highlighted: { ...defaultFillStyle, opacity: 0.6 },
    selected: { ...defaultFillStyle, opacity: 0.6 },
    muted: { ...defaultFillStyle, opacity: 0.2 },
  },
  {
    normal: { ...defaultFillStyle, opacity: 0.9 },
    highlighted: { ...defaultFillStyle, opacity: 1.0 },
    selected: { ...defaultFillStyle, opacity: 1.0 },
    muted: { ...defaultFillStyle, opacity: 0.2 },
  },
];

const defaultAggregation = {
  size: '5m',
  reducers: {
    outer: [min(), max()],
    inner: [percentile(25), percentile(75)],
    center: median(),
  },
};

function getAggregatedSeries(series, column, aggregation = defaultAggregation) {
  const { size, reducers } = aggregation;
  const { inner, outer, center } = reducers;

  function mapColumn(c, r) {
    const obj = {};
    obj[c] = r;
    return obj;
  }

  const fixedWindowAggregation = {};

  if (inner) {
    fixedWindowAggregation.innerMin = mapColumn(column, inner[0]);
    fixedWindowAggregation.innerMax = mapColumn(column, inner[1]);
  }

  if (outer) {
    fixedWindowAggregation.outerMin = mapColumn(column, outer[0]);
    fixedWindowAggregation.outerMax = mapColumn(column, outer[1]);
  }

  if (center) {
    fixedWindowAggregation.center = mapColumn(column, center);
  }

  return series.fixedWindowRollup({
    windowSize: size,
    aggregation: fixedWindowAggregation,
  });
}

/**
 * Renders a boxplot chart.
 */
export default class BoxChart extends React.Component {

  constructor(props) {
    super(props);
    this.series = getAggregatedSeries(props.series,
                                      props.column,
                                      props.aggregation);
  }

  componentWillReceiveProps(nextProps) {
    const aggregation = nextProps.aggregation;

    let aggregationChanged = false;
    if (_.isUndefined(aggregation) !== _.isUndefined(this.props.aggregation)) {
      aggregationChanged = true;
    }

    if (aggregation && this.props.aggregation) {
      if (aggregation.size !== this.props.aggregation.size) {
        aggregationChanged = true;
      }
    }

    if (aggregationChanged) {
      this.series = getAggregatedSeries(nextProps.series,
                                        nextProps.column,
                                        nextProps.aggregation);
    }
  }

  shouldComponentUpdate(nextProps) {
    const newSeries = nextProps.series;
    const oldSeries = this.props.series;
    const width = nextProps.width;
    const timeScale = nextProps.timeScale;
    const yScale = nextProps.yScale;
    const column = nextProps.column;
    const style = nextProps.style;
    const aggregation = nextProps.aggregation;

    const widthChanged = (this.props.width !== width);
    const timeScaleChanged = (scaleAsString(this.props.timeScale) !== scaleAsString(timeScale));
    const yAxisScaleChanged = (this.props.yScale !== yScale);
    const columnChanged = this.props.column !== column;
    const styleChanged = (JSON.stringify(this.props.style) !== JSON.stringify(style));

    let aggregationChanged = false;
    if (_.isUndefined(aggregation) !== _.isUndefined(this.props.aggregation)) {
      aggregationChanged = true;
    }

    if (aggregation && this.props.aggregation) {
      if (aggregation.size !== this.props.aggregation.size) {
        aggregationChanged = true;
      }
    }

    let seriesChanged = false;
    if (oldSeries.length !== newSeries.length) {
      seriesChanged = true;
    } else {
      seriesChanged = !TimeSeries.is(oldSeries, newSeries);
    }

    return (
      seriesChanged ||
      timeScaleChanged ||
      widthChanged ||
      columnChanged ||
      styleChanged ||
      yAxisScaleChanged ||
      aggregationChanged
    );
  }
  /*
  handleHover(e, event, column) {
    const bar = { event, column };
    if (this.props.onHighlightChange) {
      this.props.onHighlightChange(bar);
    }
  }

  handleHoverLeave() {
    if (this.props.onHighlightChange) {
      this.props.onHighlightChange(null);
    }
  }

  handleClick(e, event, column) {
    const bar = { event, column };
    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(bar);
    }
    e.stopPropagation();
  }
  */

  providedStyleArray(column) {
    let style = defaultStyle;
    if (this.props.style) {
      if (this.props.style instanceof Styler) {
        style = this.props.style.boxChartStyle()[column];
      } else if (_.isFunction(this.props.style)) {
        style = this.props.style(column);
      } else if (_.isObject(this.props.style)) {
        style = this.props.style ? this.props.style[column] : defaultStyle;
      }
    }
    return style;
  }

  /**
   * Returns the style used for drawing the path
   */
  style(event, level) {
    let style;
    if (!this.providedStyle) {
      this.providedStyle = this.providedStyleArray(this.props.column);
    }

    if (!_.isNull(this.providedStyle) && (!_.isArray(this.providedStyle) || this.providedStyle.length !== 3)) {
      console.warn('Provided style to BoxChart should be an array of 3 objects');
      return defaultStyle;
    }

    const isHighlighted =
      this.props.highlighted &&
      column === this.props.highlighted.column &&
      Event.is(this.props.highlighted.event, event);

    const isSelected =
      this.props.selected &&
      column === this.props.selected.column &&
      Event.is(this.props.selected.event, event);

    if (this.props.selected) {
      if (isSelected) {
        if (!this.selectedStyle) {
          this.selectedStyle = merge(true,
                defaultStyle[level].selected,
                this.providedStyle[level].selected ? this.providedStyle[level].selected : {});
        }
        style = this.selectedStyle;
      } else if (isHighlighted) {
        if (!this.highlightedStyle) {
          this.highlightedStyle = merge(true,
                  defaultStyle[level].highlighted,
                  this.providedStyle[level].highlighted ? this.providedStyle[level].highlighted : {});
        }
        style = this.highlightedStyle;
      } else {
        if (!this.mutedStyle) {
          this.mutedStyle = [];
        }
        if (!this.mutedStyle[level]) {
          this.mutedStyle[level] = merge(true,
                                         defaultStyle[level].muted,
                                         this.providedStyle[level].muted ?
                                         this.providedStyle[level].muted : {});
        }
        style = this.mutedStyle[level];
      }
    } else if (isHighlighted) {
      style = merge(true,
              defaultStyle[level].highlighted,
              this.providedStyle[level].highlighted ? this.providedStyle[level].highlighted : {});
    } else {
        if (!this.normalStyle) {
          this.normalStyle = [];
        }
        if (!this.normalStyle[level]) {
          this.normalStyle[level] = merge(true,
                  defaultStyle[level].normal,
                  this.providedStyle[level].normal ? this.providedStyle[level].normal : {});
        }
        style = this.normalStyle[level];
    }

    return style;
  }

  renderBars() {
    const spacing = +this.props.spacing;
    const timeScale = this.props.timeScale;
    const yScale = this.props.yScale;

    const bars = [];
    // let eventMarker;

    //
    // Convert the series
    //

    for (const event of this.series.events()) {
      const begin = event.begin();
      const end = event.end();
      const beginPos = timeScale(begin) + spacing;
      const endPos = timeScale(end) - spacing;
      let width = this.props.size ? this.props.size : endPos - beginPos;
      if (width < 1) {
        width = 1;
      }

      let x;
      if (this.props.size) {
        const center = timeScale(begin) + (timeScale(end) - timeScale(begin)) / 2;
        x = center - (this.props.size / 2);
      } else {
        x = timeScale(begin) + spacing;
      }

      const index = event.index();

      const styles = [];
      styles[0] = this.style(event, 0);
      styles[1] = this.style(event, 1);
      styles[2] = this.style(event, 2);

      const d = event.data();

      const innerMin = d.has('innerMin') ? yScale(event.get('innerMin')) : null;
      const innerMax = d.has('innerMax') ? yScale(event.get('innerMax')) : null;
      const outerMin = d.has('outerMin') ? yScale(event.get('outerMin')) : null;
      const outerMax = d.has('outerMax') ? yScale(event.get('outerMax')) : null;
      const center = d.has('center') ? yScale(event.get('center')) : null;

      let hasInner = true;
      let hasOuter = true;
      let hasCenter = true;
      if (_.isNull(innerMin) || _.isNull(innerMax)) {
        hasInner = false;
      }
      if (_.isNull(outerMin) || _.isNull(outerMax)) {
        hasOuter = false;
      }
      if (_.isNull(center)) {
        hasCenter = false;
      }

      if (hasOuter) {
        let level = 0;
        if (!hasInner) {
          level += 1;
        }
        if (!hasCenter) {
          level += 1;
        }
        const keyOuter = `${this.series.name()}-${index}-outer`;
        const boxOuter = { x, y: outerMax, width, height: outerMin - outerMax, rx: 2, ry: 2 };
        const barOuterProps = { key: keyOuter, ...boxOuter, style: styles[level] };
        bars.push(
          <rect {...barOuterProps} />
        );
      }

      if (hasInner) {
        let level = 1;
        if (!hasCenter) {
          level += 1;
        }
        const keyInner = `${this.series.name()}-${index}-inner`;
        const boxInner = { x, y: innerMax, width, height: innerMin - innerMax, rx: 1, ry: 1 };
        const barInnerProps = { key: keyInner, ...boxInner, style: styles[level] };
        bars.push(
          <rect {...barInnerProps} />
        );
      }

      if (hasCenter) {
        const level = 2;
        const keyCenter = `${this.series.name()}-${index}-center`;
        const boxCenter = { x, y: center, width, height: 1 };
        const barCenterProps = { key: keyCenter, ...boxCenter, style: styles[level] };
        bars.push(
          <rect {...barCenterProps} />
        );
      }

      // Event marker if info provided and hovering
      /*
      const isHighlighted = this.props.highlighted &&
                  column === this.props.highlighted.column &&
                  Event.is(this.props.highlighted.event, event);
      if (isHighlighted && this.props.info) {
        eventMarker = (
          <EventMarker
            {...this.props}
            offsetX={offset}
            offsetY={yBase - ypos}
            event={event}
            column={column}
          />
        );
      }
      */
    }

    return (
      <g>
        {bars}
        { /* eventMarker */ }
      </g>
    );
  }

  render() {
    return (
      <g>
        {this.renderBars()}
      </g>
    );
  }
}

BoxChart.propTypes = {
  /**
   * What [Pond TimeSeries](http://software.es.net/pond#timeseries)
   * data to visualize
   */
  // series: React.PropTypes.instanceOf(TimeSeries).isRequired,

  series: (props, propName, componentName) => {
    const value = props[propName];
    if (!(value instanceof TimeSeries)) {
      return new Error(`A TimeSeries needs to be passed to ${componentName} as the 'series' prop.`);
    }

    const t = value.collection().type();
    if (t instanceof Event) {
      console.log('Event style TimeSeries supplied');
    }

    if (t instanceof TimeRangeEvent || t instanceof IndexedEvent) {
      console.log('Event style TimeSeries supplied');
    }

    // everythin ok
    return null;
  },

  /**
   * The distance in pixels to inset the bar chart from its actual timerange
   */
  spacing: React.PropTypes.number,

  /**
   * The column within a Event based TimeSeries to summarize
   */
  column: React.PropTypes.string,

  /**
   * The aggregation specification. This object should contain:
   *   - innerMax
   *   - innerMin
   *   - outerMax
   *   - outerMin
   *   - center
   * Though each of the pairs, and center, is optional.
   * For each of these keys you should supply the function you
   * want to use to calculate these. You can import common functions
   * from Pond, e.g. min(), avg(), percentile(95), etc.
   */
  aggregation: React.PropTypes.shape({
    size: React.PropTypes.string,
    reducers: React.PropTypes.shape({
      inner: React.PropTypes.arrayOf(React.PropTypes.func), // eslint-disable-line
      outer: React.PropTypes.arrayOf(React.PropTypes.func), // eslint-disable-line
      center: React.PropTypes.func,                         // eslint-disable-line
    }),
  }), // eslint-disable-line

  /**
   * The style of the bar chart drawing (using SVG CSS properties).
   * This is an object with a key for each column which is being drawn,
   * per the `columns` prop. For each column a style is defined for
   * each state the bar may be in. This style is the CSS properties for
   * the underlying SVG <Rect>, so most likely you'll define fill and
   * opacity.
   *
   * For example:
   * ```
   * style = {
   *     columnName: {
   *         normal: {
   *             fill: "steelblue",
   *             opacity: 0.8,
   *         },
   *         highlighted: {
   *             fill: "#a7c4dd",
   *             opacity: 1.0,
   *         },
   *         selected: {
   *             fill: "orange",
   *             opacity: 1.0,
   *         },
   *         muted: {
   *             fill: "grey",
   *             opacity: 0.5
   *         }
   *     }
   * }
   * ```
   *
   * You can also supply a function, which will be called with an event
   * and column. The function should return an object containing the
   * four states (normal, highlighted, selected and muted) and the corresponding
   * CSS properties.
   */
  style: React.PropTypes.oneOfType([
    React.PropTypes.object,
    React.PropTypes.func,
    React.PropTypes.instanceOf(Styler),
  ]),

  /**
   * The style of the info box and connecting lines
   */
  infoStyle: React.PropTypes.object,  //eslint-disable-line

  /**
   * The width of the hover info box
   */
  infoWidth: React.PropTypes.number,  //eslint-disable-line

  /**
   * The height of the hover info box
   */
  infoHeight: React.PropTypes.number,  //eslint-disable-line

  /**
   * The values to show in the info box. This is an array of
   * objects, with each object specifying the label and value
   * to be shown in the info box.
   */
  info: React.PropTypes.arrayOf(      //eslint-disable-line
    React.PropTypes.shape({
      label: React.PropTypes.string,  //eslint-disable-line
      value: React.PropTypes.string,  //eslint-disable-line
    })
  ),

  /**
   * If size is specified, then the bar will be this number of pixels wide. This
   * prop takes priority over "spacing".
   */
  size: React.PropTypes.number,

  /**
   * The selected item, which will be rendered in the "selected" style.
   * If a bar is selected, all other bars will be rendered in the "muted" style.
   *
   * See also `onSelectionChange`
   */
  selected: React.PropTypes.shape({
    event: React.PropTypes.instanceOf(IndexedEvent),
    column: React.PropTypes.string,
  }),

  /**
   * A callback that will be called when the selection changes. It will be called
   * with an object containing the event and column.
   */
  // onSelectionChange: React.PropTypes.func,

  /**
   * The highlighted item, which will be rendered in the "highlighted" style.
   *
   * See also `onHighlightChange`
   */
  highlighted: React.PropTypes.shape({
    event: React.PropTypes.instanceOf(IndexedEvent),
    column: React.PropTypes.string,
  }),

  /**
   * A callback that will be called when the hovered over bar changes.
   * It will be called with an object containing the event and column.
   */
  // onHighlightChange: React.PropTypes.func,

  /**
   * [Internal] The timeScale supplied by the surrounding ChartContainer
   */
  timeScale: React.PropTypes.func,

  /**
   * [Internal] The yScale supplied by the associated YAxis
   */
  yScale: React.PropTypes.func,

  /**
   * [Internal] The width supplied by the surrounding ChartContainer
   */
  width: React.PropTypes.number,
};

BoxChart.defaultProps = {
  column: 'value',
  spacing: 1.0,
  infoStyle: {
    line: {
      stroke: '#999',
      cursor: 'crosshair',
      pointerEvents: 'none',
    },
    box: {
      fill: 'white',
      opacity: 0.90,
      stroke: '#999',
      pointerEvents: 'none',
    },
    dot: {
      fill: '#999',
    },
  },
  infoWidth: 90,
  infoHeight: 30,
};