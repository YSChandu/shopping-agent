"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Pre-process the content to handle custom tags and group multiple dot tags
  let processedContent = content;

  // First, let's handle multiple consecutive dot tags by grouping them
  const dotTagRegex = /<dot>([\s\S]*?)<\/dot>/g;
  const dotMatches = [...content.matchAll(dotTagRegex)];

  if (dotMatches.length > 0) {
    // Replace all dot tags with a special marker that we'll process later
    processedContent = processedContent.replace(
      dotTagRegex,
      (match, innerContent) => {
        return `\n\n**DOT_TAG_START**${innerContent.trim()}**DOT_TAG_END**\n\n`;
      }
    );
  }

  // Handle number tags
  processedContent = processedContent.replace(
    /<number>([\s\S]*?)<\/number>/g,
    (match, innerContent) => {
      return `\n\n**NUMBER_TAG_START**${innerContent.trim()}**NUMBER_TAG_END**\n\n`;
    }
  );

  return (
    <div className="prose prose-base max-w-full overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom styling for different elements
          h1: ({ children }) => (
            <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4 mt-3 sm:mt-4 md:mt-6 first:mt-0 border-b-2 border-gray-200 pb-1.5 sm:pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const childrenString =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : String(children);

            const isComparison =
              childrenString.includes("vs") ||
              childrenString.includes("versus") ||
              childrenString.includes("comparison");

            const isTopOptions =
              childrenString.toLowerCase().includes("top options") ||
              childrenString.toLowerCase().includes("recommendations") ||
              childrenString.toLowerCase().includes("suggestions");

            if (isComparison) {
              return (
                <h2 className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-blue-900 mb-1.5 sm:mb-2 md:mb-3 mt-2 sm:mt-3 md:mt-4 first:mt-0 border-b-2 border-blue-300 pb-1 sm:pb-1.5 md:pb-2 bg-blue-50 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 rounded-t-xl shadow-sm">
                  {children}
                </h2>
              );
            }

            if (isTopOptions) {
              return (
                <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-2 sm:mb-3 mt-3 sm:mt-4 first:mt-0 border-b border-gray-200 pb-1.5 sm:pb-2">
                  {children}
                </h2>
              );
            }

            return (
              <h2 className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2 md:mb-3 mt-2 sm:mt-3 md:mt-4 first:mt-0 border-b border-gray-300 pb-0.5 sm:pb-1">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const childrenString =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : String(children);

            // Check if this is a phone name (contains price)
            const isPhoneName =
              childrenString.includes("₹") || childrenString.includes("Price");

            if (isPhoneName) {
              return (
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1.5 sm:mb-2 mt-2 sm:mt-3 first:mt-0 border-b border-gray-200 pb-1">
                  {children}
                </h3>
              );
            }

            return (
              <h3 className="text-sm sm:text-base font-semibold text-blue-600 mb-1 sm:mb-1.5 md:mb-2 mt-1.5 sm:mt-2 md:mt-3 first:mt-0">
                {children}
              </h3>
            );
          },
          p: ({ children }) => {
            // Check if this paragraph contains phone data that needs reformatting
            const childrenString =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : String(children);

            // Check if it contains our custom tag markers
            const hasDotTag = childrenString.includes("**DOT_TAG_START**");
            const hasNumberTag = childrenString.includes(
              "**NUMBER_TAG_START**"
            );

            // Check if it's phone data with pipe separators or multi-line format
            const isPhoneData =
              childrenString.includes("OS:") &&
              (childrenString.includes("RAM:") ||
                childrenString.includes("Storage:")) &&
              (childrenString.includes("|") ||
                childrenString.includes("Camera:") ||
                childrenString.includes("\n"));

            // Check if it's a final recommendation (highlight when wrapped in $$$ markers)
            const isMainRecommendation =
              childrenString.includes("$$$") &&
              (childrenString.includes("I recommend") ||
                childrenString.includes("recommend") ||
                childrenString.includes("suggest") ||
                childrenString.includes("best choice") ||
                childrenString.includes("go with"));

            if (hasDotTag) {
              const content = childrenString.replace(
                /\*\*DOT_TAG_START\*\*(.*?)\*\*DOT_TAG_END\*\*/g,
                "$1"
              );

              // Check if this is a phone recommendation with specs
              const isPhoneRecommendation =
                content.includes("Key Specs:") ||
                content.includes("Why Recommended:") ||
                (content.includes("OS:") && content.includes("RAM:"));

              if (isPhoneRecommendation) {
                // Better parsing that handles both line breaks and inline content
                let phoneName = "";
                let keySpecs = "";
                let whyRecommended = "";

                // Extract phone name (everything before the first "1.")
                const phoneNameMatch = content.match(/^([^1]*?)(?=\s*1\.)/);
                if (phoneNameMatch) {
                  phoneName = phoneNameMatch[1].trim();
                }

                // Extract Key Specs (after "1." and before "2.")
                const specsMatch = content.match(
                  /1\.\s*Key Specs:\s*([^2]*?)(?=\s*2\.)/
                );
                if (specsMatch) {
                  keySpecs = specsMatch[1].trim();
                }

                // Extract Why Recommended (after "2.")
                const recMatch = content.match(/2\.\s*Why Recommended:\s*(.*)/);
                if (recMatch) {
                  whyRecommended = recMatch[1].trim();
                }

                return (
                  <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <span className="mr-2 mt-1 text-blue-600 font-bold text-xs sm:text-sm">
                        •
                      </span>
                      <div className="flex-1">
                        {/* Phone Name */}
                        {phoneName && (
                          <div className="font-semibold text-blue-900 text-xs sm:text-sm mb-1.5 sm:mb-2">
                            {phoneName}
                          </div>
                        )}

                        {/* Key Specs */}
                        {keySpecs && (
                          <div className="mb-1.5 sm:mb-2">
                            <div className="text-xs sm:text-sm font-medium text-blue-800 mb-1">
                              Key Specs:
                            </div>
                            <div className="text-xs sm:text-sm text-blue-700 bg-white p-1.5 sm:p-2 rounded border">
                              {keySpecs}
                            </div>
                          </div>
                        )}

                        {/* Recommendation */}
                        {whyRecommended && (
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-blue-800 mb-1">
                              Why Recommended:
                            </div>
                            <div className="text-xs sm:text-sm text-blue-700 bg-white p-1.5 sm:p-2 rounded border">
                              {whyRecommended}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex items-start mb-1.5 sm:mb-2">
                  <span className="mr-2 mt-1 text-blue-600 font-bold text-xs sm:text-sm">
                    •
                  </span>
                  <span className="flex-1 text-xs sm:text-sm md:text-base text-gray-800">
                    {content}
                  </span>
                </div>
              );
            }

            // Also handle cases where markers appear as literal text (fallback)
            if (
              childrenString.includes("DOT_TAG_START") &&
              childrenString.includes("DOT_TAG_END")
            ) {
              const content = childrenString.replace(
                /DOT_TAG_START\*\*\*\*(.*?)DOT_TAG_END/g,
                "$1"
              );
              return (
                <div className="flex items-start mb-1.5 sm:mb-2">
                  <span className="mr-2 mt-1 text-blue-600 font-bold text-xs sm:text-sm">
                    •
                  </span>
                  <span className="flex-1 text-xs sm:text-sm md:text-base text-gray-800">
                    {content}
                  </span>
                </div>
              );
            }

            if (hasNumberTag) {
              const content = childrenString.replace(
                /\*\*NUMBER_TAG_START\*\*(.*?)\*\*NUMBER_TAG_END\*\*/g,
                "$1"
              );
              // Extract number from content if it exists, otherwise use a simple counter
              const numberMatch = content.match(/^(\d+)\.?\s*(.*)$/);
              const number = numberMatch ? numberMatch[1] : "1";
              const text = numberMatch ? numberMatch[2] : content;
              return (
                <div className="flex items-start mb-1.5 sm:mb-2">
                  <span className="mr-2 mt-0.5 text-blue-600 font-semibold text-xs sm:text-sm min-w-[20px]">
                    {number}.
                  </span>
                  <span className="flex-1 text-xs sm:text-sm md:text-base text-gray-800">
                    {text}
                  </span>
                </div>
              );
            }

            if (isPhoneData) {
              // Clean the string to remove [object Object] and other object references
              const cleanString = childrenString
                .replace(/\[object Object\]/g, "")
                .trim();

              // Handle both pipe-separated and line-break-separated formats
              let lines: string[];
              if (cleanString.includes("|")) {
                // Pipe-separated format
                lines = cleanString
                  .split("|")
                  .map((line) => line.trim())
                  .filter((line) => line && line !== "[object Object]")
                  .slice(0, 8); // Limit to 8 specifications
              } else {
                // Line-break-separated format
                lines = cleanString
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(
                    (line) =>
                      line && line !== "[object Object]" && line.includes(":")
                  )
                  .slice(0, 8); // Limit to 8 specifications
              }

              return (
                <div className="text-sm sm:text-base text-blue-900 mb-2 sm:mb-3 p-2 sm:p-3 rounded-xl bg-blue-50 border border-blue-200 shadow-sm max-w-full overflow-hidden">
                  <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                    {lines.map((line, index) => {
                      // Check if line contains a colon (spec: value format)
                      const colonIndex = line.indexOf(":");
                      if (colonIndex > 0) {
                        const spec = line.substring(0, colonIndex).trim();
                        const value = line.substring(colonIndex + 1).trim();
                        return (
                          <div
                            key={index}
                            className="flex items-start p-2 sm:p-2.5 bg-white rounded border border-blue-100"
                          >
                            <span className="mr-2 text-blue-600 font-semibold text-xs sm:text-sm flex-shrink-0 mt-0.5">
                              {index + 1}.
                            </span>
                            <div className="flex-1">
                              <span className="font-medium text-blue-800 text-xs sm:text-sm">
                                {spec}:
                              </span>
                              <span className="text-gray-700 text-xs sm:text-sm ml-1 break-words">
                                {value}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={index}
                          className="flex items-start p-2 sm:p-2.5 bg-white rounded border border-blue-100"
                        >
                          <span className="mr-2 text-blue-600 font-semibold text-xs sm:text-sm flex-shrink-0 mt-0.5">
                            {index + 1}.
                          </span>
                          <span className="font-medium text-xs sm:text-sm break-words">
                            {line}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (isMainRecommendation) {
              // Remove $$$ markers and clean the content
              const cleanContent = childrenString.replace(/\$\$\$/g, "").trim();

              return (
                <div className="mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 md:p-4 bg-gray-50 border-l-4 border-blue-500 rounded-r-lg">
                  <div className="text-sm sm:text-base text-gray-800 font-medium">
                    {cleanContent}
                  </div>
                </div>
              );
            }

            return (
              <p className="text-sm sm:text-base text-gray-800 mb-1 sm:mb-1.5 md:mb-2 leading-relaxed">
                {children}
              </p>
            );
          },
          ul: ({ children }) => {
            // Since we don't support dashes, convert ul to ol or use custom dot styling
            // Filter out empty items and only show non-empty content
            const validChildren = Array.isArray(children)
              ? children.filter((child) => {
                  const childText =
                    typeof child === "string"
                      ? child.trim()
                      : child && typeof child === "object" && "props" in child
                      ? child.props?.children?.toString().trim() || ""
                      : "";
                  return childText && childText.length > 0;
                })
              : children;

            return (
              <ol className="text-xs sm:text-sm md:text-base text-gray-800 mb-1 sm:mb-1.5 md:mb-2 space-y-0.5 sm:space-y-1 ml-1 sm:ml-1.5 md:ml-2">
                {Array.isArray(validChildren)
                  ? validChildren.map((child, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mt-0.5 font-semibold text-gray-600 text-xs sm:text-sm md:text-base">
                          {index + 1}.
                        </span>
                        <span className="text-xs sm:text-sm md:text-base">
                          {typeof child === "string" ? child.trim() : child}
                        </span>
                      </li>
                    ))
                  : validChildren}
              </ol>
            );
          },
          ol: ({ children }) => {
            // Filter out empty items and only show non-empty content
            const validChildren = Array.isArray(children)
              ? children.filter((child) => {
                  const childText =
                    typeof child === "string"
                      ? child.trim()
                      : child && typeof child === "object" && "props" in child
                      ? child.props?.children?.toString().trim() || ""
                      : "";
                  return childText && childText.length > 0;
                })
              : children;

            return (
              <ol className="text-xs sm:text-sm md:text-base text-gray-800 mb-1 sm:mb-1.5 md:mb-2 space-y-0.5 sm:space-y-1 ml-1 sm:ml-1.5 md:ml-2">
                {Array.isArray(validChildren)
                  ? validChildren.map((child, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mt-0.5 font-semibold text-gray-600 text-xs sm:text-sm md:text-base">
                          {index + 1}.
                        </span>
                        <span className="text-xs sm:text-sm md:text-base">
                          {typeof child === "string" ? child.trim() : child}
                        </span>
                      </li>
                    ))
                  : validChildren}
              </ol>
            );
          },
          li: ({ children }) => {
            // Check if this is a phone recommendation by looking for phone patterns
            const childrenString =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.join("")
                : String(children);

            const isPhoneRecommendation =
              childrenString.includes("$$$") &&
              (childrenString.includes("iPhone") ||
                childrenString.includes("Samsung") ||
                childrenString.includes("Price:") ||
                childrenString.includes("₹"));

            if (isPhoneRecommendation) {
              // For phone recommendations, render as a span to avoid nested li elements
              return (
                <span className="text-xs sm:text-sm text-gray-800 mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 rounded-lg border-l-4 border-blue-500 block">
                  {children}
                </span>
              );
            }

            // For regular list items, use simple indentation
            return (
              <li className="text-xs sm:text-sm md:text-base text-gray-800 ml-1 sm:ml-2 md:ml-3">
                {children}
              </li>
            );
          },
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs sm:text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-100 text-gray-800 p-1.5 sm:p-2 md:p-3 rounded-lg overflow-x-auto text-xs sm:text-sm font-mono mb-1.5 sm:mb-2">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-2 sm:pl-3 md:pl-4 italic text-xs sm:text-sm md:text-base text-gray-700 mb-2 sm:mb-3 md:mb-4 mt-2 sm:mt-3 md:mt-4 bg-gray-50 py-1.5 sm:py-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => {
            // Check if this is a phone specification table by examining content
            const tableText = Array.isArray(children)
              ? children
                  .map((child) =>
                    typeof child === "string"
                      ? child
                      : child && typeof child === "object" && "props" in child
                      ? child.props?.children?.toString() || ""
                      : ""
                  )
                  .join(" ")
                  .toLowerCase()
              : String(children).toLowerCase();

            const isPhoneSpecTable =
              tableText.includes("os:") ||
              tableText.includes("ram:") ||
              tableText.includes("storage:") ||
              tableText.includes("camera:") ||
              tableText.includes("battery:") ||
              tableText.includes("display:") ||
              tableText.includes("processor:") ||
              tableText.includes("price:");

            const isComparisonTable =
              tableText.includes("vs") ||
              tableText.includes("comparison") ||
              tableText.includes("versus");

            if (isPhoneSpecTable && !isComparisonTable) {
              // Single phone specs - mobile-first responsive design
              return (
                <div className="mb-2 sm:mb-3 rounded-xl bg-blue-50 border border-blue-200 shadow-sm max-w-full overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-max p-2 sm:p-3 md:p-4">
                      <div className="text-sm sm:text-base text-blue-900">
                        {/* Mobile: Single column, Desktop: Multi-column */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2 min-w-[280px] sm:min-w-[400px]">
                          {Array.isArray(children) ? (
                            children.slice(0, 8).map((child, index) => {
                              let childText =
                                typeof child === "string"
                                  ? child
                                  : child &&
                                    typeof child === "object" &&
                                    "props" in child
                                  ? child.props?.children?.toString() || ""
                                  : "";

                              // Clean any [object Object] references
                              childText = childText
                                .replace(/\[object Object\]/g, "")
                                .trim();

                              return (
                                <div
                                  key={index}
                                  className="flex items-start p-1.5 sm:p-2 md:p-2.5 bg-white rounded border border-blue-100 min-w-[250px] sm:min-w-[180px]"
                                >
                                  <span className="font-medium text-blue-800 text-xs sm:text-sm md:text-base break-words leading-relaxed">
                                    {childText}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-start p-1.5 sm:p-2 md:p-2.5 bg-white rounded border border-blue-100 min-w-[250px] sm:min-w-[180px]">
                              <span className="font-medium text-blue-800 text-xs sm:text-sm md:text-base break-words leading-relaxed">
                                {String(children)
                                  .replace(/\[object Object\]/g, "")
                                  .trim()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (isComparisonTable) {
              // Comparison table - mobile-first responsive design
              return (
                <div className="mb-2 sm:mb-3 rounded-xl shadow-sm border border-blue-200 max-w-full overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      <div className="bg-blue-100 px-2 sm:px-3 py-2 sm:py-3">
                        <h3 className="text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wider">
                          Comparison Details
                        </h3>
                      </div>
                      <div className="bg-white min-w-[320px] sm:min-w-[400px]">
                        {Array.isArray(children) ? (
                          children.slice(0, 8).map((child, index) => {
                            let childText =
                              typeof child === "string"
                                ? child
                                : child &&
                                  typeof child === "object" &&
                                  "props" in child
                                ? child.props?.children?.toString() || ""
                                : "";

                            // Clean any [object Object] references
                            childText = childText
                              .replace(/\[object Object\]/g, "")
                              .trim();

                            const [key, ...valueParts] = childText.split(":");
                            const value = valueParts.join(":").trim();

                            return (
                              <div
                                key={index}
                                className="border-b border-blue-100 last:border-b-0"
                              >
                                {/* Mobile: Stacked layout, Desktop: Side-by-side */}
                                <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                                  <div className="block sm:flex sm:items-start">
                                    <div className="w-full sm:w-1/3 sm:pr-2 mb-1 sm:mb-0">
                                      <div className="text-xs sm:text-sm text-blue-800 font-medium">
                                        {key}
                                      </div>
                                    </div>
                                    <div className="w-full sm:w-2/3">
                                      <div className="text-xs sm:text-sm text-blue-800 break-words">
                                        {value}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5">
                            <div className="text-xs sm:text-sm text-blue-800 font-medium mb-1">
                              Specification
                            </div>
                            <div className="text-xs sm:text-sm text-blue-800 break-words">
                              {String(children)
                                .replace(/\[object Object\]/g, "")
                                .trim()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Regular table - mobile-first responsive design with horizontal scroll
            return (
              <div className="mb-2 sm:mb-3 rounded-xl shadow-sm border border-blue-200 max-w-full overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-max">
                    <table className="w-full text-xs sm:text-sm min-w-[300px] sm:min-w-[400px]">
                      {children}
                    </table>
                  </div>
                </div>
              </div>
            );
          },
          thead: ({ children }) => (
            <thead className="bg-blue-100">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-1 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 text-left text-xs sm:text-sm font-semibold text-blue-900 uppercase tracking-wider whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-1 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 text-xs sm:text-sm text-blue-800 border-b border-blue-200 bg-white break-words min-w-[80px]">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700 text-xs sm:text-sm md:text-base">
              {children}
            </em>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline text-xs sm:text-sm md:text-base"
            >
              {children}
            </a>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
