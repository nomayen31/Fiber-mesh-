/**
 * A minimal bar chart drawn with `react-native-svg`.
 *
 * The web dashboard uses Recharts; there is no drop-in equivalent that keeps the
 * same look in React Native, so this reproduces the *shape* of the widget (bars,
 * brand blue, slate gridlines, first/last labels) without the library weight.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";

import { colors, space, typography } from "@/theme";

export type SparkPoint = { label: string; value: number };

const CHART_HEIGHT = 110;

export function BarChart({
  points,
  emptyLabel = "এই সময়ে কোনো তথ্য নেই",
}: {
  points: SparkPoint[];
  emptyLabel?: string;
}) {
  const [width, setWidth] = useState(0);

  const values = points.map((point) => point.value);
  const max = Math.max(1, ...values);
  const hasData = values.some((value) => value > 0);

  const gap = 3;
  const barWidth = points.length > 0 ? Math.max(2, (width - gap * (points.length - 1)) / points.length) : 0;

  return (
    <View style={styles.wrapper}>
      {!hasData ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : null}

      <View
        style={styles.chartArea}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            {/* baseline + midline, mirroring the web chart's CartesianGrid */}
            <Line
              x1={0}
              y1={CHART_HEIGHT - 0.5}
              x2={width}
              y2={CHART_HEIGHT - 0.5}
              stroke={colors.slate[200]}
              strokeWidth={1}
            />
            <Line
              x1={0}
              y1={CHART_HEIGHT / 2}
              x2={width}
              y2={CHART_HEIGHT / 2}
              stroke={colors.slate[100]}
              strokeWidth={1}
            />
            {points.map((point, index) => {
              const ratio = point.value / max;
              const height = Math.max(point.value > 0 ? 3 : 0, ratio * (CHART_HEIGHT - 8));
              return (
                <Rect
                  key={`${point.label}-${index}`}
                  x={index * (barWidth + gap)}
                  y={CHART_HEIGHT - height}
                  width={barWidth}
                  height={height}
                  rx={3}
                  fill={colors.brand[600]}
                  opacity={point.value > 0 ? 1 : 0.15}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>

      {points.length > 0 ? (
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{points[0]?.label}</Text>
          <Text style={styles.axisLabel}>{points[points.length - 1]?.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  chartArea: { height: CHART_HEIGHT, width: "100%" },
  empty: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  emptyText: { fontSize: typography.size.sm, color: colors.slate[400] },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { fontSize: typography.size.xs, color: colors.slate[400] },
});
