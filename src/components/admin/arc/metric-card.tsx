import type { DashboardDelta } from "@/lib/admin/dashboard-core";

import styles from "./arc.module.css";

// Arc UI's free `metric-card` (https://uiarc.dev/r/metric-card.json), ported
// for the panel: the same card (label and change pill on top, the figure,
// a line of context) drawn on the server, without the rolling counter (the
// panel takes no animation library). The pill is green when the change is
// good news and red when it is not, and says which way in words too.

export function MetricCard({
  label,
  value,
  context,
  change,
}: {
  label: string;
  /** The figure, already formatted ("₺1.250,00", "42"). */
  value: string;
  /** What the figure is read against. */
  context: string;
  change?: DashboardDelta;
}) {
  return (
    <article className={`${styles.arc} ${styles.metric}`}>
      <div className={styles.metricTop}>
        <span>{label}</span>
        {change ? (
          <small data-good={String(change.good)}>
            {change.direction === "up" ? "↑" : "↓"} {change.label}
            <span className={styles.srOnly}> {change.spoken}</span>
          </small>
        ) : null}
      </div>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricContext}>{context}</p>
    </article>
  );
}
