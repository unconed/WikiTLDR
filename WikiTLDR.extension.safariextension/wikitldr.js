// Quick'n'dirty identification due to changing domains and barebones HTML.
if (document.title == 'Cable Viewer' && ($('div.paginator').length == 0)) {

  // HTML template with %placeholders / @placeholders.
  var pageTemplate = 
    '<div id="wikitldr">'+
      '<div id="note">%note</div>'+
      '<div id="header">'+
        '<hgroup>'+
          '<h2 class="classification @classification"><span>%classification</span></h2>'+
          '<h2 class="time">'+
            '<span class="year">%publishedYear</span>'+
            '<span class="monthday">%publishedMonth %publishedDay</span>'+
            '<span class="time">%publishedTime</span>'+
          '</h2>'+
          '<h2 class="reference"><span>%reference</span></h2>'+
        '</hgroup>'+
        '<aside>'+
          '%map'+
        '</aside>'+
        '<section>'+
          '<dl>'+
            '<dt>From</dt>'+
            '<dd>%from</dd>'+
            '<dt>To</dt>'+
            '<dd>%to</dd>'+
            '<dt>CC</dt>'+
            '<dd>%routed</dd>'+
          '</dl>'+
          '<h1>%title</h1>'+
          '<details>'+
            '<button>More info</button>'+
            '<time>Released on: %released</time>'+
            '<address>%id</address>'+
          '</details>'+
          '<details>%tags</details>'+
        '</section>'+
      '</div>'+
      '<div id="body">'+
      '</div>'+
    '</div>';
  
  // Inject stylesheet here as last, rather than in the extension, to ensure CSS priority.
  var link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', safari.extension.baseURI + 'wikitldr.css');
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
//      countryTags,
      programTags,
      organizationTags,
    ]);

    // Make a map based on the source.
    metadata.map = makeMap($(metadata.origin).text());
    console.log(metadata.map);

    // Insert metadata into template.
    for (key in metadata) {
      // Get value.
      var replace = metadata[key];
      if (!replace) {
        replace = '<em>n/a</em>';
      }
      
      // Transform into HTML.
      var $fragment = $('<div>'+ replace +'</div>'), $text = $fragment;
      while ($text.children().length) { $text = $text.find('> :eq(0)'); };
      $text.text(makeTitleCase($text.text()));
      
      // Fill in placeholders (HTML and IDs/Classes).
      pageTemplate = pageTemplate.replace(new RegExp('%'+ key, 'g'), $fragment.html());
      pageTemplate = pageTemplate.replace(new RegExp('@'+ key, 'g'), $fragment.text().toLowerCase());
    }
    
    // Output template.
    $('table.cable').before(pageTemplate);

    // Hide empty elements.
    if (!metadata.note) {
      $('#note').hide();
    }

//    $('table.cable').hide();
//    $('code').hide();
  });
  
  /**
   * Create a map for the given location.
   */
  function makeMap(location) {
    var $iframe = $('<iframe></iframe>');
    $iframe.css({
      border: 0,
      margin: 0,
      padding: 0,
    }).attr('src', safari.extension.baseURI + 'map.html#' + escape(location));
    
    console.log(safari.extension.baseURI + 'map.html#' + escape(location));
    
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
    
    // Straight up fields.
    metadata.reference      = $elements.filter(':eq(0)').html();
    metadata.released       = $elements.filter(':eq(2)').html();
    metadata.from           =
    metadata.origin         = $elements.filter(':eq(4)').html();

    // Parse date.
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul',
    'Aug','Sep','Oct','Nov','Dec'];
    var date = $elements.filter(':eq(1)').html();
    date.replace(/([0-9]+)-([0-9]+)-([0-9]+) ([0-9]+):([0-9]+)/,
        function (m, year, month, day, hours, minutes) {
          month = months[parseInt(month, 10)];
          metadata.publishedYear = year;
          metadata.publishedMonth = month;
          metadata.publishedDay = day;
          metadata.publishedTime = hours +':'+ minutes;
        }
      );
    
    // Parse classification.
    var c = $elements.filter(':eq(3)').html();
    c = c.split(/\/\//).join(" / ");
    metadata.classification = c;
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
      [ /^This record.+$/, { 0: 'note' } ],
      [ /^INFO (([^\n\/]+\/[^\n]+(\n|$))+)/m, { 1: 'routed' } ],
    ];

    // Apply matching rules to body text.
    applyRules(text, rules, metadata);
    
    // Clean up routing records.
    var keys = ['from', 'to', 'routed'];
    for (i in keys) {
      i = keys[i];
      if (metadata[i]) {
        metadata[i] = metadata[i]
          .replace(/(^\b)[A-Z0-9]+\/(?=[A-Z])/mg, '')
          .replace(/ (IMMEDIATE )?[0-9]{3,5}$/mg, '');
      }
    }
  }
  
  /**
   * Parse metadata of out body.
   */
  function parseBody($element, metadata) {

    // Pre-process header text.
    var text = $element.text();

    // Matching rules for identifying data.
    var rules = [
//      [ /^[A-Z]+: (((?!\s+\n)[^\n]+\n)+)/m, { 1: 'title' } ],
      [ /^SUBJECT: (((?!\s+\n|[A-Z][a-z])[^\n]+\n)+)/m, { 1: 'title' } ],
      [ /^TAGS:? (((?!\s+\n|[A-Z][a-z]|[A-Z]+:)[^\n]+\n)+)/m, { 1: 'tags' } ],
    ];
    
    // Apply matching rules to body text.
    applyRules(text, rules, metadata);
    
  }
  
  /**
   * Apply regexp rules to lines of text.
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
    var words = text.replace(/\n/g, ' ').split(/ /);
    for (i = words.length - 1; i >= 0; i--) {
      words[i] = words[i].replace(/^(["'.,()-]*)([A-Z"'.,()-]+)$/, function (m, pre, text) { return pre + text.substring(0,1) + text.substring(1).toLowerCase(); });
    }
    return words.join(' ');
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
    
    // Apply replacements to obj.
    var regexp = new RegExp('(' + string + ')', 'g');
    for (i in obj) {
      obj[i] = obj[i].replace(regexp, function (m, tag) {
        return map[tag];
      });
    }
  }
  
}
