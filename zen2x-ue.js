/**
  * Zen X ("extended") HTML
  * Zen X CSS is planned
  *
  * @author Misha Yurasov (myurasov@gmail.com)
  */

var zen2x = {};
zen2x.html = {};
zen2x.version = "0.01";

/**
  * Zen Coding 2x HTML expression parser
  * @author Misha Yurasov <myurasov@gmail.com>
  */
zen2x.html.parser = {

  // [Private]

  /**
    * Parse Zen 2x HTML expression (w/o parentheses) into tree
    * @param expression string
    * @return object Parsed tree | FALSE on error
    */
  _parse_plain: function(expression, parts, alias_parts)
  {
    // Regular expressions

    var RE_PART   = /^(\$\$?)([0-9]+)\b/;                                     // numbered expression part
    var RE_ELEM   = /^[A-Za-z0-9]+(?::[A-Za-z0-9\-]+)?(?:\+(?=\+|>|\*|$))?/;  // element, alias or complex alias ("el+") in $0
    var RE_CLASS  = /^\.(?:\\\.|[0-9A-Za-z\-_\:\$%])*/;                       // class in $0
    var RE_ID     = /^\#(?:\\\.|[0-9A-Za-z\-_\:\$%])*/;                       // id in $0
    var RE_ATTRIB = /^\[\s*(.*?)\s*(?:\=\s*(.*?)\s*)?\]/;                     // [attr=val], [attr] attribute in $1, value in $2
    var RE_REPEAT = /^\*\d+/;                                                 // repeat

    var element           = "",
        attributes        = {},
        repeat            = 1,
        m                 = null,
        current_fragment,
        children          = null,
        brothers          = null,
        result            = [],
        element_is_found  = false;

    // Match part or element

    while (1)
    {
      // Match part
      m = expression.match(RE_PART);

      if (m != null) // Part found
      {
        if (m[1] == "$") // Parenthesis part
        {
          current_fragment = this._clone_ao(parts[parseInt(m[2])]);

          if (current_fragment === undefined)
          {
            this.error = "Part $" + m[2] + " doesn't exist";
            return false;
          }
        }
        else if (m[1] == "$$") // Alias part
        {
          current_fragment = this._clone_ao(alias_parts[parseInt(m[2])]);

          if (current_fragment === undefined)
          {
            this.error = "Alias part $$" + m[2] + " doesn't exist";
            return false;
          }
        }

        expression = expression.substring(m[0].length);
        break; // while (1)
      }

      // Match element

      m = expression.match(RE_ELEM);

      if (m != null)
      {
        element = m[0];

        if (this.config.default_attributes[element] !== undefined) // Default attribute (element[:type])
        {
          // Assign default element attributes (for original element:type)
          attributes = this._clone_ao(this.config.default_attributes[element]) || {};

          // Remove ":type" part
          element = element.replace(/:.*$/, "");
        }

        if (this.config.complex_aliases[element] !== undefined) // Process complex alias (smth+)
        {
          var alias_part_index = alias_parts.length;

          if (false === (alias_parts[alias_part_index] = this.parse(this.config.complex_aliases[element])))
          {
            // Error
            return false;
          }

          expression = "$$" + alias_part_index.toString() + expression.substring(element.length);
          continue; // while (1)
        }
        else if (this.config.element_aliases[element] !== undefined) // Replace element alias
        {
          element = this.config.element_aliases[element];

          // Assign default element attributes (for replaced element)
          attributes = this._clone_ao(this.config.default_attributes[element]) || {};
        }

        element_is_found = true;
        expression = expression.substring(m[0].length);
        break; // while (1)
      }
      else
      {
        this.error = "Syntax error near \"" + expression + "\"";
        return false;
      }
    }

    if (element_is_found) // Element found
    {
      // Match attributes

      var search_atributes = true;

      while (search_atributes)
      {
        search_atributes = false;

        // Attribute

        m = expression.match(RE_ATTRIB);

        if (m != null)
        {
          if (m[1] == "")
          {
            // [=val]
            this.error = "Syntax error near \"" + expression + "\"";
            return false;
          }

          // Format id and clas attributes
          if (m[1].toLowerCase() == "class" || m[1].toLowerCase() == "id")
          {
            m[1] = m[1].toLowerCase();
          }

          if (m[1] == "class")
          {
            // Add class
            attributes["class"] = (attributes["class"] !== undefined
              ? attributes["class"] + " " : "") + m[0];
          }
          else // Attribute name is not class/id
          {
            if (m[1].charAt(0) == "!") // Remove attribute (atrribute name is: !attribute_name)
            {
              m[1] = m[1].substring(1); // remove first char

              if (attributes[m[1]] !== undefined)
              {
                delete attributes[m[1]];
              }
            }
            else // Assign attribute
            {
              attributes[m[1]] = m[2];
            }
          }

          expression = expression.substring(m[0].length);
          search_atributes = true;
        }

        // ID

        m = expression.match(RE_ID);

        if (m != null)
        {
          attributes["id"] = m[0].substring(1); // remove #
          expression = expression.substring(m[0].length);
          search_atributes = true;
        }

        // Class

        m = expression.match(RE_CLASS);

        if (m != null)
        {
          // Add class
          attributes["class"] = (attributes["class"] !== undefined
            ? attributes["class"] + " " : "") + m[0].substring(1);
          expression = expression.substring(m[0].length);
          search_atributes = true;
        }
      }

      // Current parsed expression fragment
      current_fragment = [{element: element, attributes: attributes, children: []}];
    }

    // Match repeats

    while (1)
    {
      m = expression.match(RE_REPEAT);

      if (m != null)
      {
        repeat = repeat * parseInt(m[0].substring(1)); // remove * and update repeat counter
        expression = expression.substring(m[0].length);
        continue;
      }

      break;
    }

    // Continue

    if (expression.length > 0)
    {
      if (expression.charAt(0) == ">")
      {
        // Children
        if (false === (children = this._parse_plain(expression.substring(1), parts, alias_parts)))
        {
          // Error
          return false;
        }

        // Add children to each brother in current fragment
        for (var i = 0; i < current_fragment.length; i++)
        {
          current_fragment[i].children =
            current_fragment[i].children.concat(this._clone_ao(children));
        }
      }
      else if (expression.charAt(0) == "+")
      {
        // Brothers
        if (false === (brothers = this._parse_plain(expression.substring(1), parts, alias_parts)))
        {
          // Error
          return false;
        }
      }
      else
      {
        // Error
        this.error = "Expected \">\" or \"+\" near \"" + expression + "\"";
        return false;
      }
    }

    // Repeat

    for (var i = 0; i < repeat; i++)
    {
      result = result.concat(current_fragment);
    }

    // Apppend brothers

    if (brothers != null)
    {
      result = result.concat(brothers);
    }

    // Done

    return result;
  },

  /**
    * Clones array or object
    * @param data Array/Object
    */
  _clone_ao: function(data)
  {
    // Is array?
    var _is_a = function(v) {
      return v && (v instanceof Array || typeof v == "array");
    };

    // Is object?
    var _is_o = function(v)
    {
      return (v !== undefined)
        && (v === null || typeof v == "object" || _is_a(v));
    };

    if (!data) { return data; }

    // Array

    if (_is_a(data))
    {
      var result = new Array();

      for (var i = 0; i < data.length; i++)
      {
        result.push(this._clone_ao(data[i]));
      }

      return result;
    }

    // Value

    if (!_is_o(data))
    {
      return data;
    }

    // Object

    var result = new data.constructor();

    for (var i in data)
    {
      if (!(i in result) || result[i] != data[i])
      {
        result[i] = this._clone_ao(data[i]);
      }
    }

    return result;
  },

  // [Public]

  /**
    * Parse zen2x HTML expression into tree with parts buffer
    * @param expression string
    * @return Array || false
    */
  parse: function(expression)
  {
    var RE_PARENTHESIS = /\((?:\\\\|\\.|[^\(\)])+\)/; // Next parenthesis

    var m,
        expression_part,
        part_index = 0,
        parts = new Array,
        alias_parts = new Array;

    while((m = RE_PARENTHESIS.exec(expression)) != null)
    {
      // Replace part with @#
      expression = expression.substring(0, m.index)
        + "$" + part_index
        + expression.substring(m.index + m[0].length);

      expression_part = m[0].substring(1, m[0].length - 1);

      if (false === (parts[part_index] = this._parse_plain(expression_part, parts, alias_parts)))
      {
        return false;
      }

      part_index++;
    }

    return this._parse_plain(expression, parts, alias_parts);
  },

  error: ""  // Last error message
};

/**
  * Parser configuration
  *
  */
zen2x.html.parser.config =
{
  // Aliases for elements

  element_aliases:
  {
    "bq" : "blockquote",
    "acr" : "acronym",
    "fig" : "figure",
    "ifr" : "iframe",
    "emb" : "embed",
    "obj" : "object",
    "src" : "source",
    "cap" : "caption",
    "colg" : "colgroup",
    "fst" : "fieldset",
    "btn" : "button",
    "optg" : "optgroup",
    "opt" : "option",
    "tarea" : "textarea",
    "leg" : "legend",
    "sect" : "section",
    "art" : "article",
    "hdr" : "header",
    "ftr" : "footer",
    "adr" : "address",
    "dlg" : "dialog",
    "str" : "strong",
    "prog" : "progress",
    "fset" : "fieldset",
    "datag" : "datagrid",
    "datal" : "datalist",
    "kg" : "keygen",
    "out" : "output",
    "det" : "details",
    "cmd" : "command"
  },

  // Complex aliases (end with "+")

  complex_aliases:
  {
    "ol+" : "ol>li",
    "ul+" : "ul>li",
    "dl+" : "dl>dt+dd",
    "map+" : "map>area",
    "table+" : "table>tr>td",
    "colgroup+" : "colgroup>col",
    "colg+" : "colgroup>col",
    "tr+" : "tr>td",
    "select+" : "select>option",
    "optgroup+" : "optgroup>option",
    "optg+" : "optgroup>option"
  },

  // Default attributes for elements (element[:type])

  default_attributes:
  {
    "a" : {"href" : ""},
    "a:link" : {"href" : "%startsel%http://%endsel%"},
    "a:mail" : {"href" : "mailto:%cursor%"},
    "abbr" : {"title" : ""},
    "acronym" : {"title" : ""},
    "area" : {"shape" : "", "coords" : "", "href" : "", "alt" : ""},
    "area:c" : {"shape" : "circle", "coords" : "", "href" : "", "alt" : ""},
    "area:d" : {"shape" : "default", "href" : "", "alt" : ""},
    "area:p" : {"shape" : "poly", "coords" : "", "href" : "", "alt" : ""},
    "area:r" : {"shape" : "rect", "coords" : "", "href" : "", "alt" : ""},
    "audio" : {"src" : ""},
    "base" : {"href" : ""},
    "bdo" : {"dir" : ""},
    "bdo:l" : {"dir" : "ltr"},
    "bdo:r" : {"dir" : "rtl"},
    "embed" : {"src" : "", "type" : ""},
    "form" : {"action" : ""},
    "form:get" : {"action" : "", "method" : "get"},
    "form:post" : {"action" : "", "method" : "post"},
    "html:xml" : {"xmlns" : "http://www.w3.org/1999/xhtml", "xml:lang" : "ru"},
    "iframe" : {"src" : "", "frameborder" : "0"},
    "img" : {"src" : "", "alt" : ""},
    "input" : {"type" : ""},
    "input:b" : {"type" : "button", "value" : ""},
    "input:button" : {"type" : "button", "value" : ""},
    "input:c" : {"type" : "checkbox", "name" : "", "id" : ""},
    "input:checkbox" : {"type" : "checkbox", "name" : "", "id" : ""},
    "input:color" : {"type" : "color", "name" : "", "id" : ""},
    "input:date" : {"type" : "date", "name" : "", "id" : ""},
    "input:datetime" : {"type" : "datetime", "name" : "", "id" : ""},
    "input:datetime-local" : {"type" : "datetime-local", "name" : "", "id" : ""},
    "input:email" : {"type" : "email", "name" : "", "id" : ""},
    "input:f" : {"type" : "file", "name" : "", "id" : ""},
    "input:file" : {"type" : "file", "name" : "", "id" : ""},
    "input:h" : {"type" : "hidden", "name" : ""},
    "input:hidden" : {"type" : "hidden", "name" : ""},
    "input:i" : {"type" : "image", "src" : "", "alt" : ""},
    "input:image" : {"type" : "image", "src" : "", "alt" : ""},
    "input:month" : {"type" : "month", "name" : "", "id" : ""},
    "input:number" : {"type" : "number", "name" : "", "id" : ""},
    "input:p" : {"type" : "password", "name" : "", "id" : ""},
    "input:password" : {"type" : "password", "name" : "", "id" : ""},
    "input:r" : {"type" : "radio", "name" : "", "id" : ""},
    "input:radio" : {"type" : "radio", "name" : "", "id" : ""},
    "input:range" : {"type" : "range", "name" : "", "id" : ""},
    "input:reset" : {"type" : "reset", "value" : ""},
    "input:s" : {"type" : "submit", "value" : ""},
    "input:search" : {"type" : "search", "name" : "", "id" : ""},
    "input:submit" : {"type" : "submit", "value" : ""},
    "input:t" : {"type" : "text", "name" : "", "id" : ""},
    "input:text" : {"type" : "text", "name" : "", "id" : ""},
    "input:time" : {"type" : "time", "name" : "", "id" : ""},
    "input:url" : {"type" : "url", "name" : "", "id" : ""},
    "input:week" : {"type" : "week", "name" : "", "id" : ""},
    "label" : {"for" : ""},
    "link" : {"rel" : "stylesheet", "href" : ""},
    "link:atom" : {"rel" : "alternate", "type" : "application/atom+xml", "title" : "Atom", "href" : "%startsel%atom%endsel%.xml"},
    "link:css" : {"rel" : "stylesheet", "type" : "text/css", "href" : "%startsel%style%endsel%.css", "media" : "all"},
    "link:favicon" : {"rel" : "shortcut icon", "type" : "image/x-icon", "href" : "%startsel%favicon%endsel%.ico"},
    "link:print" : {"rel" : "stylesheet", "type" : "text/css", "href" : "%startsel%print%endsel%.css", "media" : "print"},
    "link:rss" : {"rel" : "alternate", "type" : "application/rss+xml", "title" : "RSS", "href" : "%startsel%rss%endsel%.xml"},
    "link:touch" : {"rel" : "apple-touch-icon", "href" : "%startsel%favicon%endsel%.png"},
    "map" : {"name" : ""},
    "menu:c" : {"type" : "context"},
    "menu:context" : {"type" : "context"},
    "menu:t" : {"type" : "toolbar"},
    "menu:toolbar" : {"type" : "toolbar"},
    "meta:compat" : {"http-equiv" : "X-UA-Compatible", "content" : "IE=7"},
    "meta:utf" : {"http-equiv" : "Content-Type", "content" : "text/html;charset=UTF-8"},
    "meta:win" : {"http-equiv" : "Content-Type", "content" : "text/html;charset=Win-1251"},
    "object" : {"data" : "", "type" : ""},
    "option" : {"value" : ""},
    "param" : {"name" : "", "value" : ""},
    "script" : {"type" : "text/javascript"},
    "script:src" : {"type" : "text/javascript", "src" : ""},
    "select" : {"name" : "", "id" : ""},
    "style" : {"type" : "text/css"},
    "textarea" : {"name" : "", "id" : "", "cols" : "30", "rows" : "10"},
    "video" : {"src" : ""}
  }
};


/**
  * HTML code generator
  *
  */
zen2x.html.generator =
{
  // Service tags

  _cursor_tag:      "%cursor%",        // Custom cursor position
  __cursor_tag:     "%_cursor%",       // Automatically placed cursor
  _startsel_tag:    "%startsel%",      // Selection start
  _endsel_tag:      "%endsel%",        // Selection end
  _children_tag:    "%children%",      // Snippet children

  /**
  * Initialize generator
  *
  */
  _init: function()
  {
    // Parse config

    var __parse_config_str = function(str)
    {
      var a = str.split(",");
      var r = {};

      for (var i = 0; i < a.length; i++)
      {
        r[a[i]] = true;
      }

      return r;
    };

    // no_end_tag_elements
    this.config._no_end_tag_elements = __parse_config_str(this.config.no_end_tag_elements);

    // boolean_attributes
    this.config._boolean_attributes = __parse_config_str(this.config.boolean_attributes);

    // inline_tags
    this.config._inline_tags = __parse_config_str(this.config.inline_tags);

    this._init.done = true;
  },

  /**
  * Create start tag code
  * @param tag object
  * @return string
  */
  _start_tag: function(tag, counter)
  {
    counter = counter || 1;

    var attribute_name,
        is_minimized_form,
        element_name_f,
        attribute_value,
        attributes_str = "";

    for (attribute_name in tag.attributes)
    {
      attribute_value = tag.attributes[attribute_name];

      // XHTML requires attributes and tags to appear in lower case
      // http://www.w3.org/TR/html/#h-4.11
      attribute_name = this.config.xhtml_mode ? attribute_name.toLowerCase() : attribute_name;

      if (attribute_value === undefined) // Only attrubute name
      {
        attributes_str += " " + this._add_qoutes(attribute_name, true);

        // Boolean attributes in XHTML (attrib="attrib")

        if (this._is_boolean_attribute(attribute_name) && this.config.xhtml_mode)
        {
          attributes_str += "=" + this._add_qoutes(attribute_name);
        }
      }
      else
      {
        if (attribute_value != "")
        {
          // Replace $ (counter)
          if (attribute_value.indexOf("$") != -1)
          {
            attribute_value = attribute_value.replace(/\$\$/g, "%dollar%");   // $$ -> %dollar%
            attribute_value = attribute_value.replace(/\$/g, counter);        // $ -> counter
            attribute_value = attribute_value.replace(/%dollar%/g, "$");      // %dollar% -> $
          }
        }
        else
        {
          // Place cursor at empty attribute
          attribute_value = this.__cursor_tag;
        }

        attributes_str += " " + this._add_qoutes(attribute_name, true) +
          "=" + this._add_qoutes(attribute_value);
      }
    }

    // XHTML requires attributes and tags to appear in lower case
    // http://www.w3.org/TR/html/#h-4.11
    element_name_f = this.config.xhtml_mode ? tag.element.toLowerCase() : tag.element;

    // XHTML minimized form for empty elements
    is_minimized_form = this.config.xhtml_mode && this._is_no_end_tag(tag);

    return "<" + element_name_f + attributes_str + (is_minimized_form ? " /" : "") + ">";
  },

  /**
  * Create end tag code
  * @param tag object
  * @return string
  */
  _end_tag: function(tag)
  {
    return this._is_no_end_tag(tag)
    ? ""
    : "</" + (this.config.xhtml_mode
      ? tag.element.toLowerCase()
      : tag.element) + ">";
  },

  /**
  * Add quotes around string
  * @param str string
  * @param with_sepatators_only boolean
  */
  _add_qoutes: function(str, with_sepatators_only)
  {
    var has_quotes = false;

    with_sepatators_only = with_sepatators_only || false;

    if (with_sepatators_only)
    {
      if (str.indexOf(" ") == -1 && str.indexOf("=") == -1)
      {
        return str;
      }
    }

    if (str.charAt(0) != '"' || str.charAt(0) != "'" || (str.charAt(str.length - 1) != str.charAt(0)))
    {
      str = this.config.quotes + str + this.config.quotes;
    }

    return str;
  },

  /**
  * Checks whether tag has no end tag
  * @param tag object
  * @return boolean
  */
  _is_no_end_tag: function(tag)
  {
    return tag.element in this.config._no_end_tag_elements ? true : false;
  },

  /**
  * Checks whether tag is inline (returns false if tag has block children)
  * @param tag object
  * @return boolean
  */
  _is_inline_tag: function(tag)
  {
    var is_inline = false;

    if (this._is_snippet(tag)) // Snippet
    {
      if (this.config.snippets[tag.element].indexOf("\n") == -1)
      {
        // Snippet w/o line breaks
        is_inline = true;
      }
    }
    else // Tag
    {
      // Is in inline tags list?
      is_inline = tag.element in this.config._inline_tags ? true : false;
    }

    // Check if all children are inline too

    if (is_inline)
    {
      for (var i = 0; i < tag.children.length; i++)
      {
        if (!this._is_inline_tag(tag.children[i]))
        {
          is_inline = false;
          break;
        }
      }
    }

    return is_inline;
  },

  /**
  * Checks whether attribute is boolean
  * @param attribute_name string
  * @return boolean
  */
  _is_boolean_attribute: function(attribute_name)
  {
    return attribute_name in this.config._boolean_attributes ? true : false;
  },

  /**
  * Checks whether tag is a code snippet
  * @param tag object
  * @return boolean
  */
  _is_snippet: function(tag)
  {
    return tag.element in this.config.snippets ? true : false;
  },

  /**
  * Generates inline tag code line (included as new line in block element)
  * @param tag object
  * @param counter integer
  * @return string
  */
  _generate_inline: function(tag, counter, only_children)
  {
    counter = counter || 1;
    only_children = only_children || false;

    var code = "";

    if (!only_children)
    {
      code += this._start_tag(tag, counter);
    }

    if (tag.children.length > 0)
    {
      for (var i = 0; i < tag.children.length; i++)
      {
        code += this._generate_inline(tag.children[i], i + 1);
      }
    }
    else if (!this._is_no_end_tag(tag))
    {
      // Place cursor in empty tags
      code += this.__cursor_tag;
    }

    if (!only_children)
    {
      code += this._end_tag(tag);
    }

    return code;
  },

  /**
  * Repeat string
  * @param str string
  * @param repeat int
  * @return string
  */
  _repeat_str: function(str, repeat)
  {
    return (new Array(repeat < 0 ? 0 : repeat + 1).join(str));
  },

  /**
  * Generate code prom parsed tree
  * @param tree array
  * @param indent integer Indentation level (0 = no indent)
  * @return string
  */
  _generate_raw: function(tree, indent)
  {
    indent = indent || 0;

    // Initialize
    if (!this._init.done) { this._init(); };

    var indent_str,
        is_inline,
        code = "",  // Resulting code
        tag,        // Current tag object (element with properties)
        i;

    // Generate indent string

    indent_str = this._repeat_str("\t", indent);

    // Walk through brothers

    for (i = 0; i < tree.length; i++)
    {
      tag = tree[i];
      is_inline = this._is_inline_tag(tag);

      if (this._is_snippet(tag)) // Code snippet
      {
        // Snippet text
        var snippet = this.config.snippets[tag.element];

        // Locate %children%
        var snippet_children_position = snippet.indexOf(this._children_tag);

        if (snippet_children_position == -1) // No %children% tag
        {
           code += "\n";
           code += indent_str;
           code += snippet;
        }
        else // %children% tag present
        {
          var snippet_before = snippet.substring(0, snippet_children_position);
          var snippet_after = snippet.substring(snippet_children_position + this._children_tag.length);
          var snippet_children = "";
          var snippet_code = "";

          if (is_inline)
          {
            // Generate inline snippet children
            snippet_children = this._generate_inline(tag, i + 1, true);
          }
          else
          {
            // Determine snippet children indentation

            var snippet_children_indentation = 0;

            for (var t = snippet_before.length - 1; t >= 0; t--)
            {
              if (snippet_before.charAt(t) == "\t")
              {
                snippet_children_indentation++;
              }
              else
              {
                break;
              }
            }

            // Trim tabulation before children
            snippet_before = snippet_before.replace(/\t*$/, "");

            // Generate snippet children
            snippet_children = this._generate_raw(tag.children,
              snippet_children_indentation);
          }

          // Compose snippet code

          snippet_code = snippet_before;
          snippet_code += snippet_children;
          snippet_code += snippet_after;

          // Add snippet to code
          code += "\n";
          code += this._indent(snippet_code, indent);
        }
      }
      else if (is_inline) // Inline tag
      {
        code += "\n";
        code += indent_str;
        code += this._generate_inline(tag, i + 1);
      }
      else // Block-level tag
      {
        // Start tag
        code += "\n";
        code += indent_str;
        code += this._start_tag(tag, i + 1);

        // Content
        
        var no_end_tag = this._is_no_end_tag(tag);
        
        if (tag.children.length > 0 || !no_end_tag)
        {
          code += "\n";
          code += this._generate_raw(tag.children,
            indent + 
              (no_end_tag ? 0 : 1) // Do not indent children of tags without end tag
          );
        }

        // End tag
        if (!no_end_tag)
        {
          code += "\n";
          code += indent_str;
          code += this._end_tag(tag);
        }
      }
    }

    if (code == "")
    {
      // Place cursor tag at empty line
      code = indent_str + this.__cursor_tag;
    }
    else
    {
      // Remove leading newline symbol
      code = code.substring(1);
    }

    return code;
  },

  /**
  * Add indentation to text
  * @param str string
  * @param indent integer Indentation level (0 = no indent)
  */
  _indent: function(str, indent)
  {
    str = str.split(/\n/g);

    // == repeat(tab) + line
    var indent_str = this._repeat_str("\t", indent);

    for (var i = 0; i < str.length; i++)
    {
      str[i] = indent_str + str[i];
    }

    str = str.join("\n");

    return str;
  },

 /**
  * Prepare string to be used in regular expression
  * @param str string
  * @return string
  */
  _escape_for_regexp: function(str)
  {
    var special_chars = ["/", ".", "*", "+", "?", "|", "(", ")", "[", "]", "{", "}", "\\"];
    var re = new RegExp("(\\" + special_chars.join("|\\") + ")", "g");
    return str.replace(re, "\\$1");
  },

  /**
  * Finally format code:
  *   - remove service tags,
  *   - locate selection and cursor,
  *   - replace \t, \n to custom values
  *
  * @param code string
  * @param place_cursor boolean
  * @return string
  */
  _final_format: function(code, place_cursor)
  {
    var m,
        blank_line_re = "",
        blank_lines = 0,
        service_tags_re = "",
        cursor_pos = -1,
        _cursor_pos = -1,
        cursor_col = 0,
        cursor_line = -1,
        cursor_found = false,
        cursor_is_on_blank_line = false;

    // Replace newlines with custom value

    if (this.config.newline != "\n")
    {
      code = code.replace(/\n/g, this.config.newline);
    }

    // Replace tabs with custom value

    if (this.config.tab != "\t")
    {
      code = code.replace(/\t/g, this.config.tab);
    }

    // Compose regular expression for blank line check

    blank_line_re += "^(";
    blank_line_re += this._escape_for_regexp(this.config.tab);
    blank_line_re += ")*";
    blank_line_re += this._escape_for_regexp(this.__cursor_tag);
    blank_line_re = new RegExp(blank_line_re, "");

    // Compose regular expression to replace service tags

    service_tags_re += "";
    service_tags_re += this._escape_for_regexp(this._cursor_tag);
    service_tags_re += "|";
    service_tags_re += this._escape_for_regexp(this.__cursor_tag);
    service_tags_re += "|";
    service_tags_re += this._escape_for_regexp(this._startsel_tag);
    service_tags_re += "|";
    service_tags_re += this._escape_for_regexp(this._endsel_tag);
    service_tags_re += "";
    service_tags_re = new RegExp(service_tags_re, "g");

    // Split code into lines
    var lines = code.split(this.config.newline);
    var lines_new = [];

    // Walk through lines, fromat them and locate selection

    var sel = {start: {line: 1, col: 1}, end: {line: 1, col: 1}},
        sel_level = 0,
        sel_pos = -1,
        sel_found = false;

    for (var i = 0; i < lines.length; i++)
    {
      if (place_cursor)
      {
        // Search for cursor
  
        if (!cursor_found)
        {
          cursor_pos = lines[i].indexOf(this._cursor_tag); // user-placed cursor
          _cursor_pos = lines[i].indexOf(this.__cursor_tag); // automatically inserted cursor
  
          if (_cursor_pos != -1 && cursor_pos == -1)
          {
            cursor_pos = _cursor_pos;
          }
          /*else if (_cursor_pos == -1 && cursor_pos != -1)
          {
            cursor_pos = cursor_pos;
          }*/
          else if (_cursor_pos != 1 && cursor_pos != -1 )
          {
            cursor_pos = Math.min(cursor_pos, _cursor_pos);
          }
  
          if (cursor_pos != -1)
          {
            cursor_line = i + 1 - blank_lines;
            cursor_col = cursor_pos + 1;
            cursor_found = true;
          }
        }
  
        // Locate selection
  
        if (!sel_found)
        {
          // Look for selection start
  
          if (-1 != (sel_pos = lines[i].indexOf(this._startsel_tag)))
          {
            // Selection start found
  
            if (sel_level == 0)
            {
              sel.start.line = i + 1;
              sel.start.col = sel_pos + 1;
            }
  
            sel_level++;
          }
  
          // Look for selection end
  
          if (-1 != (sel_pos = lines[i].indexOf(this._endsel_tag)))
          {
            // Selection end found
  
            sel_level--;
  
            if (sel_level == 0)
            {
              sel.end.line = i + 1;
              sel.end.col = sel_pos + 1 - this._startsel_tag.length;
              sel_found = true;
            }
            else if (sel_level < 0)
            {
              this.error = "Extra " + this._endsel_tag + "found in \"" + lines[i] + "\"";
              return false;
            }
          }
        }
      }
      
      // Remove blank lines

      m = lines[i].match(blank_line_re);

      if (m != null)
      {
        if (place_cursor && (cursor_line == i + 1 - blank_lines)) // Cursor is on current line
        {
          cursor_is_on_blank_line = true;
        }

        blank_lines++;
      }
      else
      {
        lines_new[lines_new.length] = lines[i];
      }
    }

    // Choose between cursor and selection

    if (place_cursor && cursor_found)
    {
      if (!sel_found || (sel_found && sel.start.line >= cursor_line && sel.start.col > cursor_col))
      {
        sel.start.line = sel.end.line = cursor_line;
        sel.start.col = sel.end.col = cursor_col;

        if (cursor_is_on_blank_line)
        {
          lines_new[cursor_line - 1] = this._repeat_str(this.config.tab, cursor_pos / this.config.tab.length) + this.config.newline + lines_new[cursor_line - 1];
        }
      }
    }
    else if (place_cursor && !sel_found)
    {
      sel.start.line = sel.end.line = lines_new.length;
      sel.start.col = sel.end.col = lines_new[lines_new.length - 1].length + 1;
    }

    lines_new = lines_new.join(this.config.newline).replace(service_tags_re, "");
    this.selection = sel;

    return lines_new;
  },

  /**
  * Generate code prom parsed tree
  * Code can contain extra newlines
  * @param tree array
  * @param indent integer Indentation level (0 = no indent)
  * @param place_cursor boolean Place cursor in the code?
  * @return string
  */
  generate: function(tree, indent, place_cursor)
  {
    if (place_cursor === undefined) { place_cursor = true };
    
    // Generate raw code
    var code = this._generate_raw(tree, indent);

    // Format and find selction

    code = this._final_format(code, place_cursor);
    //
    if (code === false)
    {
      return false;
    }

    return code;
  },

  // Selection position in the generated code
  selection: {start: {line: 1, col: 1}, end: {line: 1, col: 1}}
}

/**
  * Generator configuration
  *
  */
zen2x.html.generator.config =
{
  tab         : "\t",   // Tab stop sequence
  newline     : "\n",   // New line sequence
  quotes      : "\"",   // Quote char ("/')
  xhtml_mode  : true,   // HTML/XHTML mode switch

  // Code snippets

  snippets:
  {
    "cc:ie" : "<!--[if IE]>\n\t%children%\n<![endif]-->",

    "cc:noie" : "<!--[if !IE]><!-->\n\t%children%\n<!--<![endif]-->",

    "dt:4t" : "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" \"http://www.w3.org/TR/html4/loose.dtd\">",

    "dt:4s" : "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01//EN\" \"http://www.w3.org/TR/html4/strict.dtd\">",

    "dt:xt" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">",

    "dt:xs" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">",

    "dt:xxs" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">",

    "dt:5" : "<!DOCTYPE HTML>",

    "html:4t" : "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" \"http://www.w3.org/TR/html4/loose.dtd\">\n" +
        "<html lang=\"ru\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta http-equiv=\"Content-Type\" content=\"text/html;charset=UTF-8\">\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>",

    "html:4s" : "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01//EN\" \"http://www.w3.org/TR/html4/strict.dtd\">\n" +
        "<html lang=\"ru\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta http-equiv=\"Content-Type\" content=\"text/html;charset=UTF-8\">\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>",

    "html:xt" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"ru\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta http-equiv=\"Content-Type\" content=\"text/html;charset=UTF-8\" />\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>",

    "html:xs" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"ru\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta http-equiv=\"Content-Type\" content=\"text/html;charset=UTF-8\" />\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>",

    "html:xxs" : "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n" +
        "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"ru\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta http-equiv=\"Content-Type\" content=\"text/html;charset=UTF-8\" />\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>",

    "html:5" : "<!DOCTYPE HTML>\n" +
        "<html lang=\"ru-RU\">\n" +
        "<head>\n" +
          "\t<title></title>\n" +
          "\t<meta charset=\"UTF-8\">\n" +
        "</head>\n" +
        "<body>\n\t%children%\n</body>\n" +
        "</html>"
  },

  // HTML elements that does not allow end tags
  // http://www.w3.org/TR/html401/index/elements.html
  // http://www.w3schools.com/tags/html5.asp

  no_end_tag_elements: "area,base,basefont,br,col,command,embed,frame,hr,img,input,isindex,keygen,link,meta,param",

  // Boolean attributes:
  // XHTML require boolean attributes to appear in full (non-minimized) form
  // http://www.w3.org/TR/2002/REC-xhtml1-20020801/#C_10
  boolean_attributes: "compact,nowrap,ismap,declare,noshade,checked,disabled,readonly,multiple,selected,noresize,defer",

  // Tags to be palced in one single line
  inline_tags: "a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,h1,h2,h3,h4,h5,h6,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var"
}

/**
  * Utils
  *
  */
zen2x.utils =
{
  /**
  * Indent or unindent string
  * @param str string String to indent/unindent
  * @param indent_str string Indentation sequence
  * @param indent int Indentation amount (can be negative)
  * @param newline_str str Newline sequence
  * @return string
  */
  indent: function (str, indent_str, indent, newline_str)
  {
    if (indent != 0)
    {
      newline_str = newline_str || "\n";

      var lines = str.split(newline_str);

      if (indent < 0)
      {
        for (var i = 0; i < lines.length; i++)
        {
          // Find leading tabs

          var remove_indents = 0;

          for (var ii = 0; ii < lines[i].length; ii += indent_str.length)
          {
            if (lines[i].substring(ii, ii + indent_str.length) != indent_str)
            {
              break;
            }
            else if (remove_indents >= -indent)
            {
              break;
            }
            else
            {
              remove_indents++;
            }
          }

          // Remove leading tabs
          lines[i] = lines[i].substring(remove_indents * indent_str.length);
        }
      }
      else
      {
        // == repeat(tab) + line
        var indent_str_full = (new Array(indent < 0 ? 0 : indent + 1).join(indent_str));

        for (var i = 0; i < lines.length; i++)
        {
          lines[i] = indent_str_full + lines[i];
        }
      }

      str = lines.join(newline_str);
    }

    return str;
  },

  /**
  * Detect string indentation amount
  *
  */
  detect_indentation: function(line, indent_str)
  {
    var indentation = 0;

    for (var i = 0; i < line.length; i += indent_str.length)
    {
      if (line.substring(i, i + indent_str.length) != indent_str)
      {
        break;
      }
      else
      {
        indentation++;
      }
    }

    return indentation;
  }
}

// Stuff for UltaEdit

zen2x.ultra_edit =
{
  
  /*
   * Emulate TAB key stroke
   */
  _do_tab: function()
  {
    if (!this.is_hotkey_tab) { return; }
  
    if (this.have_user_selection)
    {
      doc.write(zen2x.html.generator.config.tab)
    }
    else
    {
      var before = doc.selection.substring(0, this.old_col_num);
      var after = doc.selection.substring(this.old_col_num);
      doc.write(before + zen2x.html.generator.config.tab + after);
      doc.gotoLine(doc.currentLineNum - (after.indexOf(zen2x.html.generator.config.newline) != -1 ? 1 : 0));
      doc.endSelect();
      _right_arrow(this.old_col_num + zen2x.html.generator.config.tab.length);
    }
  },
  
  /**
  * Generate right arrow keystrokes
  * @param cols int Number of keystrokes
  */
  _right_arrow: function(cols)
  {
    while (cols-- > 0)
    {
      UltraEdit.activeDocument.key("RIGHT ARROW");
    }
  },
  
  /**
  * Write text to Output Window
  * @param text string
  */
  _out: function(text)
  {
    UltraEdit.outputWindow.write(text.toString());
  },
  
  /**
  * Run script
  */
  main: function()
  {
    // !!! UE Configuration !!!
    this.is_hotkey_tab = false;  // Is script on TAB key?        
    // this.is_hotkey_tab = true;
    zen2x.html.generator.config.tab = "  ";
    zen2x.html.generator.config.newline = "\n";
  
    // Shortcuts
    var doc = UltraEdit.activeDocument;
  
    // Save selection postion
    var old_line = doc.currentLineNum;
    this.old_col_num = doc.currentColumnNum;
    this.have_user_selection = doc.isSel();
  
    // Get source text
    if (!this.have_user_selection) { doc.selectLine(); }
    var src = doc.selection;
  
    // Trim source
    src = src.replace(/^\s*/, "").replace(/\s*$/, "");
  
    if (/\n|\r/.test(src))
    {
      // Selection is multi-line
      this._do_tab();
    }
    else
    {
      // Set HTML/XML mode
    
      if (doc.isExt("htm") || doc.isExt("html"))
      {
        zen2x.html.generator.config.xhtml_mode = false;
      }
      else if (doc.isExt("xhtml") || doc.isExt("xhtm") || doc.isExt("xml"))
      {
        zen2x.html.generator.config.xhtml_mode = true;
      }
  
      // Try to replace selection with generated code
  
      if (!this.have_user_selection)
      {
        // Detect indentation string
        if (doc.selection.charAt(0) == "\t")  { zen2x.html.generator.config.tab = "\t"; }
  
        // Detect indentation amount
        var indentation = zen2x.utils.detect_indentation(doc.selection, zen2x.html.generator.config.tab);
      }
      else
      {
        var indentation = 0;
      }
  
      // Generate code
  
      var tree, code;
  
      if (false === (tree = zen2x.html.parser.parse(src)))
      {
        this._out(zen2x.html.parser.error);
        this._do_tab();
      }
      else if (false === (code = zen2x.html.generator.generate(tree, indentation)))
      {
        this._out(zen2x.html.generator.error);
        this._do_tab();
      }
      else
      {
        doc.endSelect();
        doc.write(code + (doc.selection.indexOf(zen2x.html.generator.config.newline) != -1 ? zen2x.html.generator.config.newline : ""));
  
        // Select text
  
        sel = zen2x.html.generator.selection;

        doc.gotoLine(old_line + sel.start.line - 1);
        this._right_arrow(sel.start.col - 1 + (this.have_user_selection ? this.old_col_num : 0));
        
        if (sel.start.line == sel.end.line)
        {
          // Selection is on single line
          doc.startSelect();
          this._right_arrow(sel.end.col - sel.start.col);
        }
        else
        {
          // Multi-line selection
          doc.gotoLineSelect(sel.end.line - sel.start.line, 1);
          this._right_arrow(sel.end.col - 1 + (this.have_user_selection ? this.old_col_num : 0));
        }
      }
    }
  }
}

// Run script

zen2x.ultra_edit.main();