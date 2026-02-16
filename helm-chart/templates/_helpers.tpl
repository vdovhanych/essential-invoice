{{/*
Expand the name of the chart.
*/}}
{{- define "essential-invoice.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "essential-invoice.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "essential-invoice.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "essential-invoice.labels" -}}
helm.sh/chart: {{ include "essential-invoice.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
Backend labels.
*/}}
{{- define "essential-invoice.backend.labels" -}}
{{ include "essential-invoice.labels" . }}
{{ include "essential-invoice.backend.selectorLabels" . }}
{{- end }}

{{/*
Backend selector labels.
*/}}
{{- define "essential-invoice.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "essential-invoice.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels.
*/}}
{{- define "essential-invoice.frontend.labels" -}}
{{ include "essential-invoice.labels" . }}
{{ include "essential-invoice.frontend.selectorLabels" . }}
{{- end }}

{{/*
Frontend selector labels.
*/}}
{{- define "essential-invoice.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "essential-invoice.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Database host — subchart or external.
*/}}
{{- define "essential-invoice.databaseHost" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" .Release.Name }}
{{- else }}
{{- .Values.postgresql.external.host }}
{{- end }}
{{- end }}

{{/*
Database port.
*/}}
{{- define "essential-invoice.databasePort" -}}
{{- if .Values.postgresql.enabled }}
{{- "5432" }}
{{- else }}
{{- .Values.postgresql.external.port | toString }}
{{- end }}
{{- end }}

{{/*
Database name.
*/}}
{{- define "essential-invoice.databaseName" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.postgresql.external.database }}
{{- end }}
{{- end }}

{{/*
Database username.
*/}}
{{- define "essential-invoice.databaseUser" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.username }}
{{- else }}
{{- .Values.postgresql.external.username }}
{{- end }}
{{- end }}

{{/*
Secret name for app credentials.
*/}}
{{- define "essential-invoice.secretName" -}}
{{- if .Values.existingSecret }}
{{- .Values.existingSecret }}
{{- else }}
{{- include "essential-invoice.fullname" . }}
{{- end }}
{{- end }}

{{/*
PostgreSQL secret name for DB password.
*/}}
{{- define "essential-invoice.databaseSecretName" -}}
{{- if .Values.postgresql.enabled }}
{{- if .Values.postgresql.auth.existingSecret }}
{{- .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- printf "%s-postgresql" .Release.Name }}
{{- end }}
{{- else }}
{{- include "essential-invoice.secretName" . }}
{{- end }}
{{- end }}

{{/*
PostgreSQL secret key for DB password.
*/}}
{{- define "essential-invoice.databaseSecretKey" -}}
{{- if .Values.postgresql.enabled }}
{{- "postgres-password" }}
{{- else }}
{{- "DB_PASSWORD" }}
{{- end }}
{{- end }}

{{/*
Backend service name (used by frontend nginx proxy).
*/}}
{{- define "essential-invoice.backend.serviceName" -}}
{{- printf "%s-backend" (include "essential-invoice.fullname" .) }}
{{- end }}

{{/*
Frontend service name.
*/}}
{{- define "essential-invoice.frontend.serviceName" -}}
{{- printf "%s-frontend" (include "essential-invoice.fullname" .) }}
{{- end }}
