import * as Arr from "effect/Array"
import { dual } from "effect/Function"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"

export const TypeId: unique symbol = Symbol.for("@phosphor/ai/Xml")
export type TypeId = typeof TypeId

interface XmlElement {
  readonly _tag: "element"
  readonly name: string
  readonly attributes: Attributes
  readonly dynamicAttributes: Option.Option<DynamicAttributes>
  readonly children: ReadonlyArray<XmlChild>
  readonly inline: boolean
}

interface XmlText {
  readonly _tag: "text"
  readonly value: string
  readonly escape: boolean
}

interface XmlFragment {
  readonly _tag: "fragment"
  readonly children: ReadonlyArray<XmlChild>
  readonly separator: string
}

type XmlChild = XmlElement | XmlText | XmlFragment

export interface XmlNode extends Iterable<XmlChild>, Pipeable.Pipeable {
  readonly [TypeId]: TypeId
  readonly _node: XmlChild
  readonly length: number
  readonly toString: (options?: RenderOptions) => string
}

export type Attributes = Readonly<Record<string, string | number | boolean | undefined>>
export type DynamicAttributes = (node: XmlChild) => Attributes
export type AttributesInput = Attributes | DynamicAttributes
export type XmlInput = string | XmlNode
export type RecordValue = string | number | boolean | undefined | null | XmlNode

export interface RenderOptions {
  readonly indent?: boolean
  readonly indentString?: string
}

export const isXmlNode = (u: unknown): u is XmlNode => Predicate.hasProperty(u, TypeId)

const escapeXml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

const escapeAttribute = (str: string): string => escapeXml(str).replace(/\n/g, "&#10;").replace(/\r/g, "&#13;")

const enum StackItemType {
  Process = 0,
  CloseTag = 1,
  Separator = 2,
  IncDepth = 3,
  DecDepth = 4,
}

type StackItem =
  | { readonly type: StackItemType.Process; readonly node: XmlChild }
  | { readonly type: StackItemType.CloseTag; readonly name: string; readonly inline: boolean }
  | { readonly type: StackItemType.Separator; readonly value: string }
  | { readonly type: StackItemType.IncDepth }
  | { readonly type: StackItemType.DecDepth }

const renderNode = (root: XmlChild, options: RenderOptions = {}): string => {
  const { indent = false, indentString = "  " } = options
  const stack: Array<StackItem> = [{ type: StackItemType.Process, node: root }]
  const parts: Array<string> = []
  let depth = 0

  const addIndent = () => {
    if (indent && depth > 0) {
      parts.push(indentString.repeat(depth))
    }
  }

  while (stack.length > 0) {
    const item = stack.pop()!

    switch (item.type) {
      case StackItemType.IncDepth: {
        depth++
        break
      }

      case StackItemType.DecDepth: {
        depth--
        break
      }

      case StackItemType.Process: {
        const node = item.node

        switch (node._tag) {
          case "text": {
            parts.push(node.escape ? escapeXml(node.value) : node.value)
            break
          }

          case "element": {
            const dynamicAttrs = Option.match(node.dynamicAttributes, {
              onNone: () => ({}),
              onSome: (fn) => fn(node),
            })
            const mergedAttrs = { ...node.attributes, ...dynamicAttrs }
            const attrStr = formatAttributes(mergedAttrs)
            const openTag = attrStr === "" ? `<${node.name}>` : `<${node.name} ${attrStr}>`

            addIndent()
            parts.push(openTag)

            if (!node.inline) {
              parts.push("\n")
            }

            stack.push({
              type: StackItemType.CloseTag,
              name: node.name,
              inline: node.inline,
            })

            if (!node.inline && node.children.length > 0) {
              stack.push({ type: StackItemType.DecDepth })
            }

            for (let i = node.children.length - 1; i >= 0; i--) {
              if (i < node.children.length - 1 && !node.inline) {
                stack.push({ type: StackItemType.Separator, value: "\n" })
              }
              stack.push({ type: StackItemType.Process, node: node.children[i] })
            }

            if (!node.inline && node.children.length > 0) {
              stack.push({ type: StackItemType.IncDepth })
            }
            break
          }

          case "fragment": {
            for (let i = node.children.length - 1; i >= 0; i--) {
              if (i < node.children.length - 1) {
                stack.push({ type: StackItemType.Separator, value: node.separator })
              }
              stack.push({ type: StackItemType.Process, node: node.children[i] })
            }
            break
          }
        }
        break
      }

      case StackItemType.CloseTag: {
        if (!item.inline) {
          parts.push("\n")
          addIndent()
        }
        parts.push(`</${item.name}>`)
        break
      }

      case StackItemType.Separator: {
        parts.push(item.value)
        break
      }
    }
  }

  return parts.join("")
}

const formatAttributes = (attrs: Attributes): string =>
  Arr.filterMap(Object.entries(attrs), ([key, value]) =>
    value === undefined ? Option.none() : Option.some(`${key}="${escapeAttribute(String(value))}"`),
  ).join(" ")

const Proto: Omit<XmlNode, "_node"> = {
  [TypeId]: TypeId,
  [Symbol.iterator](): Iterator<XmlChild> {
    return getChildren((this as XmlNode)._node)[Symbol.iterator]()
  },
  get length(): number {
    return getChildren((this as XmlNode)._node).length
  },
  toString(options?: RenderOptions): string {
    return renderNode((this as XmlNode)._node, options)
  },
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

const makeNode = (node: XmlChild): XmlNode => Object.assign(Object.create(Proto), { _node: node })

const makeElement = (
  name: string,
  children: ReadonlyArray<XmlChild>,
  attributes: Attributes = {},
  inline = false,
  dynamicAttributes: Option.Option<DynamicAttributes> = Option.none(),
): XmlNode =>
  makeNode({
    _tag: "element",
    name,
    attributes,
    dynamicAttributes,
    children,
    inline,
  })

const makeText = (value: string, escape: boolean): XmlChild => ({
  _tag: "text",
  value,
  escape,
})

const makeFragment = (children: ReadonlyArray<XmlChild>, separator: string): XmlChild => ({
  _tag: "fragment",
  children,
  separator,
})

const extractChild = (input: XmlInput): XmlChild => (isXmlNode(input) ? input._node : makeText(input, true))

export const wrap: {
  (tagName: string): (self: XmlInput) => XmlNode
  (self: XmlInput, tagName: string): XmlNode
} = dual(2, (self: XmlInput, tagName: string): XmlNode => makeElement(tagName, [extractChild(self)]))

export const record: {
  (tagName: string): (self: Readonly<Record<string, RecordValue>>) => XmlNode
  (self: Readonly<Record<string, RecordValue>>, tagName: string): XmlNode
} = dual(2, (self: Readonly<Record<string, RecordValue>>, tagName: string): XmlNode => {
  const children: Array<XmlChild> = Arr.filterMap(Object.entries(self), ([key, value]) => {
    if (value === undefined || value === null) return Option.none()

    if (isXmlNode(value)) {
      const child: XmlElement = {
        _tag: "element",
        name: key,
        attributes: {},
        dynamicAttributes: Option.none(),
        children: [value._node],
        inline: false,
      }
      return Option.some(child)
    }

    const child: XmlElement = {
      _tag: "element",
      name: key,
      attributes: {},
      dynamicAttributes: Option.none(),
      children: [makeText(String(value), true)],
      inline: true,
    }
    return Option.some(child)
  })

  return makeElement(tagName, children)
})

export const nest: {
  (tagName: string): (self: ReadonlyArray<XmlInput>) => XmlNode
  (self: ReadonlyArray<XmlInput>, tagName: string): XmlNode
} = dual(
  2,
  (self: ReadonlyArray<XmlInput>, tagName: string): XmlNode => makeElement(tagName, Arr.map(self, extractChild)),
)

export const join: {
  (separator: string): (self: ReadonlyArray<XmlInput>) => XmlNode
  (self: ReadonlyArray<XmlInput>, separator: string): XmlNode
} = dual(
  2,
  (self: ReadonlyArray<XmlInput>, separator: string): XmlNode =>
    makeNode(makeFragment(Arr.map(self, extractChild), separator)),
)

export const raw = (content: string): XmlNode => makeNode(makeText(content, false))

export const text: {
  (tagName: string): (self: XmlInput) => XmlNode
  (self: XmlInput, tagName: string): XmlNode
} = dual(2, (self: XmlInput, tagName: string): XmlNode => makeElement(tagName, [extractChild(self)], {}, true))

export const withAttributes: {
  (attrs: AttributesInput): (self: XmlNode) => XmlNode
  (self: XmlNode, attrs: AttributesInput): XmlNode
} = dual(2, (self: XmlNode, attrs: AttributesInput): XmlNode => {
  const node = self._node
  if (node._tag !== "element") return self

  if (typeof attrs === "function") {
    const composed = Option.match(node.dynamicAttributes, {
      onNone: () => attrs,
      onSome: (prev) => (n: XmlChild) => ({ ...prev(n), ...attrs(n) }),
    })
    return makeNode({
      ...node,
      dynamicAttributes: Option.some(composed),
    })
  }

  const filteredAttrs = Arr.fromIterable(Object.entries(attrs).filter(([_, v]) => v !== undefined))
  if (filteredAttrs.length === 0) return self

  return makeNode({
    ...node,
    attributes: { ...node.attributes, ...Object.fromEntries(filteredAttrs) },
  })
})

export const toString = (self: XmlNode, options?: RenderOptions): string => self.toString(options)

export const getNode = (self: XmlNode): XmlChild => self._node

export const isElement = (node: XmlChild): node is XmlElement => node._tag === "element"

export const isText = (node: XmlChild): node is XmlText => node._tag === "text"

export const isFragment = (node: XmlChild): node is XmlFragment => node._tag === "fragment"

export const getChildren = (node: XmlChild): ReadonlyArray<XmlChild> => {
  switch (node._tag) {
    case "element":
    case "fragment":
      return node.children
    case "text":
      return []
  }
}

export type { XmlElement, XmlText, XmlFragment, XmlChild }
