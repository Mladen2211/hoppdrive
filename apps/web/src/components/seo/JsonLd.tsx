/**
 * Renders a JSON-LD <script> tag. Escapes `<` as the unicode escape `<`
 * (not the HTML entity `&lt;`, which would corrupt the JSON text itself) so
 * CMS-sourced text (FAQ answers, testimonials) can never break out of the
 * script tag via a literal `</script>` substring.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
