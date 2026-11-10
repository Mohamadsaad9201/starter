// Claude 5 models spend their output allowance on thinking as well as final text.
// Keep copy-writing effort bounded and reserve room for the complete response.
export function claudeWriterRequest(model: string, system: string, user: string, maxTokens: number, schema?: any) {
  const modern = /^claude-(?:sonnet|haiku|opus)-5(?:-|$)/.test(model);
  return {
    model, max_tokens: modern ? Math.max(6000, maxTokens) : maxTokens, system,
    messages: [{ role: "user", content: user }],
    ...(modern ? { output_config: { effort: "low", ...(schema ? { format: { type: "json_schema", schema } } : {}) } } : {}),
  };
}
export function claudeWriterText(response: any) {
  if (["max_tokens", "model_context_window_exceeded"].includes(response.stop_reason)) throw new Error("The writer reached its output limit. The unfinished copy was not saved; resume the audit to retry.");
  if (response.stop_reason === "refusal") throw new Error("The writer declined this request. Review the brief before retrying.");
  return (response.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}
export function seoCopySchema(count: number) {
  const keys = Array.from({ length: count }, (_, i) => String(i + 1));
  return { type: "object", properties: Object.fromEntries(keys.map(k => [k, { type: "string" }])), required: keys, additionalProperties: false };
}


