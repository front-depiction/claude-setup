/**
 * Smell Definition Schema
 *
 * Defines code smell specifications for linting and validation.
 *
 * @since 1.0.0
 */

import { Schema } from "effect"

// =============================================================================
// SmellSeverity
// =============================================================================

/**
 * Severity level of a code smell.
 *
 * @category Models
 * @since 1.0.0
 */
export const SmellSeverity = Schema.Literal("error", "warning", "info").pipe(
  Schema.annotations({
    identifier: "SmellSeverity",
    title: "Smell Severity",
    description: "Severity level for code smell violations",
  })
)

export type SmellSeverity = Schema.Schema.Type<typeof SmellSeverity>

// =============================================================================
// SmellFrontmatter
// =============================================================================

/**
 * Frontmatter metadata for a code smell definition.
 *
 * @category Models
 * @since 1.0.0
 */
export const SmellFrontmatter = Schema.Struct({
  name: Schema.String.pipe(
    Schema.annotations({
      description: "Human-readable name of the code smell",
    })
  ),
  description: Schema.String.pipe(
    Schema.annotations({
      description: "Detailed description of what this smell detects",
    })
  ),
  glob: Schema.String.pipe(
    Schema.annotations({
      description: "Glob pattern for files to check (e.g., '**/*.ts')",
    })
  ),
  pattern: Schema.String.pipe(
    Schema.annotations({
      description: "Regular expression pattern to match the smell",
    })
  ),
  tag: Schema.String.pipe(
    Schema.annotations({
      description: "Category tag for grouping smells",
    })
  ),
  severity: Schema.optional(SmellSeverity, { default: () => "warning" as const }).pipe(
    Schema.annotations({
      description: "Severity level (default: 'warning')",
    })
  ),
}).pipe(
  Schema.Data,
  Schema.annotations({
    identifier: "SmellFrontmatter",
    title: "Smell Frontmatter",
    description: "Metadata for a code smell definition",
  })
)

export type SmellFrontmatter = Schema.Schema.Type<typeof SmellFrontmatter>

/**
 * Create SmellFrontmatter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeSmellFrontmatter = Schema.decodeSync(SmellFrontmatter)

// =============================================================================
// SmellDefinition
// =============================================================================

/**
 * Complete code smell definition including frontmatter, body, and file path.
 *
 * @category Models
 * @since 1.0.0
 */
export const SmellDefinition = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  glob: Schema.String,
  pattern: Schema.String,
  tag: Schema.String,
  severity: Schema.optional(SmellSeverity, { default: () => "warning" as const }),
  body: Schema.String.pipe(
    Schema.annotations({
      description: "Markdown body content with explanation and examples",
    })
  ),
  filePath: Schema.String.pipe(
    Schema.annotations({
      description: "Absolute file path to the smell definition file",
    })
  ),
}).pipe(
  Schema.Data,
  Schema.annotations({
    identifier: "SmellDefinition",
    title: "Smell Definition",
    description: "Complete code smell definition with metadata and content",
  })
)

export type SmellDefinition = Schema.Schema.Type<typeof SmellDefinition>

/**
 * Create a SmellDefinition.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeSmellDefinition = Schema.decodeSync(SmellDefinition)

// =============================================================================
// Guards
// =============================================================================

/**
 * Type guard for SmellDefinition.
 *
 * @category Guards
 * @since 1.0.0
 */
export const isSmellDefinition = Schema.is(SmellDefinition)

/**
 * Type guard for SmellFrontmatter.
 *
 * @category Guards
 * @since 1.0.0
 */
export const isSmellFrontmatter = Schema.is(SmellFrontmatter)

// =============================================================================
// Destructors
// =============================================================================

/**
 * Get the name from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getName = (smell: SmellDefinition): string => smell.name

/**
 * Get the description from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getDescription = (smell: SmellDefinition): string => smell.description

/**
 * Get the glob pattern from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getGlob = (smell: SmellDefinition): string => smell.glob

/**
 * Get the regex pattern from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getPattern = (smell: SmellDefinition): string => smell.pattern

/**
 * Get the tag from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getTag = (smell: SmellDefinition): string => smell.tag

/**
 * Get the severity from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getSeverity = (smell: SmellDefinition): SmellSeverity => smell.severity

/**
 * Get the body from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getBody = (smell: SmellDefinition): string => smell.body

/**
 * Get the file path from a SmellDefinition.
 *
 * @category Destructors
 * @since 1.0.0
 */
export const getFilePath = (smell: SmellDefinition): string => smell.filePath
