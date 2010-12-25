// Quick'n'dirty identification due to changing domains and barebones HTML.
if (document.title == 'Cable Viewer' && ($('div.paginator').length == 0)) {

  // HTML template with %placeholders / @placeholders.
  var pageTemplate = 
    '<button>View original</button>'+
    '<div id="wikitldr">'+
      '<div id="note">%note</div>'+
      '<div id="header">'+
        '<hgroup>'+
          '<h2 class="classification @classification"><span>%classification</span></h2>'+
          '<h2 class="reference"><span>%reference</span></h2>'+
          '<h2 class="time">'+
            '<span class="year">%published.year</span>'+
            '<span class="monthday">%published.month %published.day</span>'+
            '<span class="time">%published.time</span>'+
          '</h2>'+
        '</hgroup>'+
        '<aside><section>'+
          '%map'+
          '<details>'+
            '<dl>'+
              '<dt>Origin</dt>'+
              '<dd>%origin</dd>'+
              '<dt>Released</dt>'+
              '<dd>%released.month %released.day, %released.year - %released.time</dd>'+
              '<dt style="!routed">CC</dt>'+
              '<dd style="!routed">%routed</dd>'+
              '<dt style="!declassified">Declassified</dt>'+
              '<dd style="!declassified">%declassified.month %declassified.day, %declassified.year</dd>'+
            '</dl>'+
          '</details>'+
        '</section></aside>'+
        '<section>'+
          '<h1>%title</h1>'+
          '<dl>'+
            '<dt style="!from">From</dt>'+
            '<dd style="!from">%from</dd>'+
            '<dt style="!to">To</dt>'+
            '<dd style="!to">%to</dd>'+
            '<dt style="!tags" class="tags">Tags</dt>'+
            '<dd style="!tags" class="tags">%tags</dd>'+
          '</dl>'+
        '</section>'+
      '</div>'+
      '<div id="body">'+
      '</div>'+
    '</div>';
  
  // Inject stylesheet here as last, rather than in the extension, to ensure CSS priority.
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', wikiTLDR.getURL('wikitldr.css'));
  document.getElementsByTagName('head')[0].appendChild(link);

  // Manipulate content on ready.
  $(function () {
    
    // Extract content
    var $header = $('code:eq(0) pre')
      , $body = $('code:eq(1) pre')
      , $cells = $('table.cable td')
      , $title = $('.pane.big > h3')
      , metadata = {};

    // Parse out information.
    parseTitle($title, metadata);
    parseTable($cells, metadata);
    parseHeader($header, metadata);
    parseBody($body, metadata);

    // Expand acronyms.
    expandAcronyms(metadata, [
      miscTags,
      subjectTags,
      programTags,
      organizationTags,
    ]);

    // Make a map based on the source.
    metadata.map = makeMap($(metadata.origin).text());

    // Insert metadata into template.
    for (key in metadata) {
      // Get value.
      var replace = metadata[key];
      if (!replace) {
        replace = '';
      }
      
      // Transform HTML into DOM.
      var $fragment = $('<div>'+ replace +'</div>'), $text = $fragment.add($fragment.find('*'));
      // Find all text nodes so we can alter their contents.
      $text.each(function () {
        $.each(this.childNodes, function () {
          if (this.nodeType == 3) {
            // Apply capitalization rules.
            this.textContent = makeTitleCase(this.textContent);
          }
        });
      });
      
      // Fill in placeholders (HTML and IDs/Classes).
      pageTemplate = pageTemplate.replace(new RegExp('%'+ key, 'g'), $fragment.html());
      pageTemplate = pageTemplate.replace(new RegExp('@'+ key, 'g'), $fragment.text().toLowerCase());
      pageTemplate = pageTemplate.replace(new RegExp('!'+ key, 'g'), 'display: '+ ($fragment.text().length ? 'block' : 'none'));
    }
    
    // Output template.
    $('table.cable').before(pageTemplate);

    // Process body text.
    var body = processBody($body);
    $('#wikitldr #body').html(body);

    // Hide empty elements.
    if (!metadata.note) {
      $('#note').hide();
    }

    // Bind toggle button.
    function on() {
      $('table.cable').hide();
      $('code').hide();
      $('#wikitldr').show();
      $('button').html('View Original');
    }
    function off() {
      $('table.cable').show();
      $('code').show();
      $('#wikitldr').hide();
      $('button').html('View TLDR');
    }
    $('button').toggle(off, on);

    // Show TLDR version.
    on();
  });
  
  /**
   * Create a map for the given location.
   */
  function makeMap(location) {
    
    // Optimize common queries.
    location = location.replace(/^Embassy /, '');
    
    // Output iframe.
    var $iframe = $('<iframe id="map">');
    $iframe.css({
      border: 0,
      margin: 0,
      padding: 0,
    }).attr('src', wikiTLDR.getURL('map.html') + '#' + escape(location));
    
    return $('<div>').append($iframe).html();
  }
  
  /**
   * Parse wikileaks body header.
   */
  function parseTitle($element, metadata) {
    var match = /Viewing cable ([A-Z0-9-]+), (.+)/.exec($element.text());
    if (match) {
      metadata.title = match[2];
      metadata.reference = match[1];
    }
  }
  
  /**
   * Parse Wikileaks info table.
   */
  function parseTable($elements, metadata) {
    var date;
    
    // Straight up fields.
    metadata.reference      = $elements.filter(':eq(0)').html();
    metadata.from           =
    metadata.origin         = $elements.filter(':eq(4)').html();

    // Parse creation date.
    date = $elements.filter(':eq(1)').html();
    var published = parseDate(date);
    for (i in published) {
      metadata['published.'+ i] = published[i];
    }
  
    // Parse release date.
    date = $elements.filter(':eq(2)').html();
    var released = parseDate(date);
    for (i in released) {
      metadata['released.'+ i] = released[i];
    }
    
    // Parse classification.
    var c = $elements.filter(':eq(3)').html();
    c = c.split(/\/\//).join(" / ");
    metadata.classification = c;
    
    // Process reference.
    metadata.reference = metadata.reference.replace(/([0-9]+)([A-Z]+)([0-9]+)(?=<)/g, function (x,a,b,c) { return a+'-'+b+'-'+c; })
  }

  /**
   * Parse a date.
   */
  function parseDate(text) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul',
    'Aug','Sep','Oct','Nov','Dec'];
    var object = {};
    text.replace(/([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})/,
        function (m, month, day, year) {
          month = months[parseInt(month, 10) - 1];
          object.year = year;
          object.month = month;
          object.day = day;
        }
      );
    text.replace(/([0-9]+)-([0-9]+)-([0-9]+) ([0-9]+):([0-9]+)/,
        function (m, year, month, day, hours, minutes) {
          month = months[parseInt(month, 10) - 1];
          object.year = year;
          object.month = month;
          object.day = day;
          object.time = hours +':'+ minutes;
        }
      );
    return object;
  }

  /**
   * Parse metadata of out header.
   */
  function parseHeader($element, metadata) {

    // Pre-process header text.
    var text = $element.text();

    // Matching rules for identifying data.
    var rules = [
      [ /^([A-Z0-9]{12})$/m, { 1: 'id' } ],
      [ /^FM (.+)/m, { 1: 'from' } ],
      [ /^TO (.+)/m, { 1: 'to' } ],
      [ /^This record.+$/m, { 0: 'note' } ],
      [ /^INFO (([^\n\/]+\/[^\n]+(\n|$))+)/m, { 1: 'routed' } ],
    ];

    // Apply matching rules to header text.
    applyRules(text, rules, metadata);
    
    // Clean up routing records.
    var keys = ['from', 'to', 'routed'];
    for (i in keys) {
      i = keys[i];
      if (metadata[i]) {
        // Remove extension-like numbers.
        metadata[i] = metadata[i]
          .replace(/(^\b)[A-Z0-9]+\/(?=[A-Z])/mg, '')
          .replace(/( (PRIORITY))?( [0-9]{3,5})?$/mg, function (m, prior) { return prior ? ' <span class="priority" title="Priority">•</span>' : '' })
          .replace(/( (IMMEDIATE))?( [0-9]{3,5})?$/mg, function (m, prior) { return prior ? ' <span class="immediate" title="Immediate">••</span>' : '' });

        // Wrap recipients in spans.  
        metadata[i] = '<span>'+ metadata[i].split(/\n/).join('</span> <span>') +'</span>';
      }
    }
  }
  
  /**
   * Parse metadata of out body.
   */
  function parseBody($element, metadata) {

    // Pre-process header text.
    var text = $element.html().replace(/&#x000A;/, '\n');

    // Matching rules for identifying data.
    var rules = [
//      [ /^[A-Z]+: (((?!\s+\n)[^\n]+\n)+)/m, { 1: 'title' } ],
      [ /^SUBJECT: (((?!\s+\n|[A-Z][a-z]|(REF|TAGS):?)[^\n]{30,}\n)*((?!\s+\n|[A-Z][a-z]|(REF|TAGS):?)[^\n]+\n))/m, { 1: 'title' } ],
      [ /^TAGS:? (((?!\s+\n|[A-Z][a-z]|(REF|SUBJECT):?)[^\n]{30,}\n)*((?!\s+\n|[A-Z][a-z]|(REF|SUBJECT):?)[^\n]+\n))/m, { 1: 'tags' } ],
      [ /^E\.?O\.? [0-9]+:? DECL: ([^\n]+)\n/m, { 1: 'declassified' } ],
    ];
    
    // Apply matching rules to body text.
    applyRules(text, rules, metadata);
    
    // Reformat declassified.
    if (metadata.declassified) {
      var date = parseDate(metadata.declassified);
      for (i in date) {
        metadata['declassified.' + i] = date[i];
      }      
      delete metadata.declassified;
    }
    
    // Reformat tags.
    if (metadata.tags) {
      
      // Wrap tags in spans.
      metadata.tags = '<span>'+ metadata.tags.split(/[ ,](?!href)+/).join('</span> <span>') +'</span>';

      // Expand country codes.
      metadata.tags = expandAcronyms(metadata.tags, [
        countryTags,
      ]);
      
    }
    
  }
  
  /**
   * Apply regexp matching rules to lines of text.
   */
  function applyRules(text, rules, metadata) {
    // Apply regexps.
    for (j in rules) {
      var regexp = rules[j][0]
        , map    = rules[j][1]
        , match = regexp.exec(text);
      // Set properties.
      for (k in map) if (match || !metadata[map[k]]) {
        metadata[map[k]] = match ? match[k] : '';
      }
    }      
  }

  /** 
   * Make text titlecase.
   */
  function makeTitleCase(text) {
    // Process words.
    var words = text.replace(/\n/g, ' ').split(/ /);
    for (i = words.length - 1; i >= 0; i--) {
      words[i] = words[i].replace(/((^|-)["'‘’“”.,;?()]*)([A-Z"'‘’“”.,;():]+)((?=-)|$)/g, function (m, pre, n, text) { return pre + text.substring(0,1) + text.substring(1).toLowerCase(); });
    }
    text = words.join(' ');
    
    // Patch up common errors.
    text = text.replace(uppercaseFix, function (s) { return s.toUpperCase(); })

    return text;
  }
  
  /**
   * Expand acronyms in text.
   */
  function expandAcronyms(obj, tags) {

    // Prepare datasets.
    var string
      , map = {};

    // Assemble regexp of all tags.
    for (j in tags) (function (tags) {
      for (i in tags) {
        string = (string ? string + "|" : "") + '\\b' + i + '\\b';
        map[i] = tags[i];
      }
    })(tags[j]);
    
    // Regexp callback.
    function callback(m, tag) {
      return map[tag];
    }
    
    // Apply replacements to obj.
    var regexp = new RegExp('(' + string + ')', 'g');
    if (typeof obj == 'string') {
      return obj.replace(regexp, callback);
    }
    for (i in obj) {
      obj[i] = obj[i].replace(regexp, callback);
    }
  }
  
  /**
   * Process body text.
   */
  function processBody($element) {
    
    var text = $element.html();

    var rules = [
      // Redacted information.
      [ /X{3,}/g, function (x) { return '<span class="redacted">'+ x +'</span>'; } ],
      // Subject lines (remove).
      [ /^SUBJECT: (((?!\s+\n|[A-Z][a-z]|(REF|TAGS):?)[^\n]{30,}\n)*((?!\s+\n|[A-Z][a-z]|(REF|TAGS):?)[^\n]+\n))/m, '' ],
      // Tags lines (remove).
      [ /^TAGS:? (((?!\s+\n|[A-Z][a-z]|(REF|SUBJECT):)[^\n]{30,}\n)*((?!\s+\n|[A-Z][a-z]|(REF|SUBJECT):?)[^\n]+\n))/m, '' ],
      // Declassification date (remove).
      [ /^E\.?O\.? [0-9]+:? (N\/A|DECL: ([^\n]+))(?=\n)/m, '' ],
      // Raw classification.
      [ /^(UNCLAS|C O N F I D E N T I A L|S E C R E T)( SECTION [0-9]+(\.[0-9]+)? OF [0-9]+)? [A-Z ]+ [0-9]+\s*$/m, '' ],
      // Continued cable
      [ /\n\n?([A-Z]+ )+([0-9]+ [0-9]+(\.[0-9]+)? OF [0-9]+) *\n\n?/mg, '' ],
      // Header.
      [ /^SIPDIS\s*$/mg, '' ],
      // ASCII-underlined titles
      [ new RegExp('^([A-Za-z\"\'‘’“”.,;?(): --]+)(\n| +)((-{4,}) *\n*)+\n?', 'mg'), function (m, title) { return '<h2>'+ title + '</h2>\n'; } ],
      // Slash delimited titles
      [ new RegExp('\n\n// ?([A-Za-z\"\'‘’“”.,;?(): \n--]+) ?//\n\n', 'mg'), function (m, title) { return '<h2>'+ title + '</h2>\n'; } ],
      // UPPERCASE titles
      [ new RegExp('\n\n([A-Z\"\'‘’“”.,;?(): --]+)\n\n', 'mg'), function (m, title) { return '<h2>'+ title + '</h2>\n'; } ],
      // Left-over lines
      [ /-{6,}/g, '' ],
      // Blank lines at the beginning.
      [ /^\n+/, '' ],
      // Marked paragraphs.
      [ new RegExp('^<a id="par[^>]*>¶<\/a>([^\n]+|\n(?!<)(?!\s*\n))+', 'mg'), function (m) { return '<p>' + m + '</p>\n'; } ],
      // Line-delimited paragraphs.
      [ new RegExp('^(>|\n\n)?(([^\n]+|\n(?!<)(?!\s*\n))+)', 'mg'), function (m,a,b) { return (a||'') + '\n<p>' + b + '</p>'; } ],
      // Comments
      [ /(COMMENT:?)((?:\n|.)+?)(END\s+COMMENT)/mg, function (m,a,b,c) { return a + '<em>' + b + '</em>' + c; } ],
      // Determine paragraph classification.
      [ /<p>(<a[^>]*>¶<\/a>\d+\. \(([A-Z\/]+)\))/g, function (m, prefix, category) {
        var classes = [], titles = [], rules = [
          [ /\bS\b/, 'secret', 'Secret' ],
          [ /\bC\b/, 'confidential', 'Confidential' ],
          [ /\bSBU\b/, 'sensitive', 'Sensitive but Unclassified' ],
          [ /\bU\b/, 'unclassified', 'Unclassified' ],
        ];
        for (i in rules) {
          var regexp = rules[i][0]
            , classname = rules[i][1]
            , title = rules[i][2];
          if (regexp.test(category)) {
            classes.push(classname);
            titles.push(title);
          }
        }
        return '<p class="'+ classes.join(' ') +'" title="'+ titles.join(', ') +'">'+ prefix;
      } ],
    ];
    
    for (i in rules) {
      var regexp = rules[i][0]
        , replace = rules[i][1];
        text = text.replace(regexp, replace);
    }
    
    return text;
  }
    
  // Inject analytics to track extension usage.
  var script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', wikiTLDR.getURL('analytics.js'));
  document.getElementsByTagName('head')[0].appendChild(script);
  
}
