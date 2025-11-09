import { registerOTel } from '@vercel/otel';
import {
  AzureMonitorTraceExporter,
  AzureMonitorMetricExporter,
  AzureMonitorLogExporter,
} from '@azure/monitor-opentelemetry-exporter';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { SimpleLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

export function register() {
  const useAzure = Boolean(connectionString);

  const traceExporter = useAzure
    ? new AzureMonitorTraceExporter({ connectionString })
    : new ConsoleSpanExporter();

  const metricReader = useAzure
    ? new PeriodicExportingMetricReader({
        exporter: new AzureMonitorMetricExporter({ connectionString: connectionString! }),
        exportIntervalMillis: 60_000,
      })
    : new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 60_000,
      });

  const logProcessor = useAzure
    ? new SimpleLogRecordProcessor(
        new AzureMonitorLogExporter({ connectionString: connectionString! }),
      )
    : new SimpleLogRecordProcessor(new ConsoleLogRecordExporter());

  registerOTel({
    serviceName: 'raboneko',
    traceExporter,
    metricReaders: [metricReader],
    logRecordProcessors: [logProcessor],
  });

  if (useAzure) {
    console.info('Telemetry exporting to Azure Application Insights.');
  } else {
    console.info(
      'Telemetry exporting to console; Azure Application Insights connection string not set.',
    );
  }
}
