import { Rpc } from "@opencode/plugin/rpc";

const managedSkillSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    autoinvoke: { type: "boolean" },
    path: { type: "string" },
    disabled: { type: "boolean" },
  },
  required: ["id", "name", "path", "disabled"],
  additionalProperties: false,
} as const;

const managedSkillsSchema = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: managedSkillSchema,
    },
  },
  required: ["skills"],
  additionalProperties: false,
} as const;

export const SkillsRpc = Rpc.define({
  id: "opencode-context-sidebar.skills",
  methods: {
    list: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: managedSkillsSchema,
    },
    setDisabled: {
      input: {
        type: "object",
        properties: {
          id: { type: "string" },
          disabled: { type: "boolean" },
        },
        required: ["id", "disabled"],
        additionalProperties: false,
      },
      output: managedSkillsSchema,
    },
  },
  events: {},
});
