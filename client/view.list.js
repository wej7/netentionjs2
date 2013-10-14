function getRelevant(sort, scope, semantic, s, o, maxItems) { 

    var now = Date.now();
    var location = objSpacePointLatLng(s.myself());
    
    var relevance = { };
    var focus = s.focus();
	var focusWhen = objWhen(focus);

	if (focus) semantic = 'Relevant';
    
    var ii = _.keys(self.layer().include);
    var ee = _.keys(self.layer().exclude);
    
    for (var k in s.get('attention')) {
        
        var x = s.getObject(k);
        
        if (x.replyTo)
            continue;
        
        //TAG filter
        var allowed = true;
        var tags = objTags(x);
        {
            if (ii.length > 0) {
                allowed = false;
                for (var i = 0; i < ii.length; i++) {
                    var inc = ii[i];
                    if (_.contains(tags, inc)) {
                        allowed = true;
                        break;
                    }                    
                }
            }
            if (ee.length > 0) {
                for (var i = 0; i < ee.length; i++) {
                    var exc = ee[i];
                    if (_.contains(tags, exc)) {
                        allowed = false;
                        break;
                    }                    
                }            
            }
        }    
        
        if (!allowed)
            continue;
        
        //scope prefilter
        if (scope == 'Mine') {
            if (x.author != s.id())
                continue;
        }
        else if (scope == 'Others') {
            if (x.author == s.id())
                continue;                            
        }
        
        //sort
        var r = 1.0;                        
        if (sort == 'Recent') {
            var w = x.modifiedAt || x.createdAt || null;
            if (w == null) continue;
            var ageSeconds = Math.abs(now - w) / 1000.0;
            //r = Math.exp(-ageSeconds/10000.0);
            r = 1.0 / (1.0 + ageSeconds / 60.0);
        }
        else if (sort == 'Near') {
            
            if (!location) {
                continue;
            }
            
            var llx = objSpacePointLatLng(x);
            if (!llx) {
                continue;
            }
            
            var distance = geoDist(location, llx); //kilometers
            //r = Math.exp(-distance/10000.0);
            r = 1.0 / (1.0 + distance);
        }
		//DEPRECATED
        else if (sort == 'Spacetime') {
            var llx = objSpacePointLatLng(x);
            if ((!location) || (!llx) || (!x.when)) {
                continue;
            }   
            var timeDistance = Math.abs(now - x.when) / 1000.0; //seconds
            var spaceDistance = geoDist(location, llx) * 1000.0; //meters
            //r = Math.exp(-(timeDistance + spaceDistance)/10000.0);            
            r = 1.0 / (1.0 + ((timeDistance/60.0) + spaceDistance));
        }
        
        if (semantic == 'Relevant') { 
            if (focus) {
				if (focus.name) {
					var fn = focus.name.toLowerCase();
					var xn = (x.name||'').toLowerCase();
					if (xn.indexOf(fn)==-1)
						r = 0;
				}

				if (r > 0) {
					var ft = objTags(focus);
					if (ft.length > 0) {
					    var m = objTagRelevance(focus, x);
					    r *= m;
					}
				}
				if (r > 0) {
					if (focusWhen) {
						var f = focusWhen.from;
						var t = focusWhen.to;
						var wx = objWhen(x);
						if (typeof wx === 'number') {
							if (wx < f) r = 0;
							if (wx > t) r = 0;
							//console.log(wx, focusWhen);							
						}
					}
				}
            }
            else
                r = 0;
        }
        
        if (r > 0) {                                    
            relevance[k] = r;
        }
    }
    
    var relevant = _.keys(relevance);
    relevant.sort(function(a, b) {
	    return relevance[b] - relevance[a];
	});
    
    if (relevant.length > maxItems) {
        o.prepend('<span>Too many: 1..' + maxItems + ' of ' + relevant.length + '</span>');
    }
    else {
        
    }
    return [ _.first(relevant, maxItems), relevance ];
}

function renderItems(s, o, v, maxItems, perItems) {
    var sort = s.get('list-sort') || 'Recent';
    var scope = s.get('list-scope') || 'Public';
    var semantic = s.get('list-semantic') || 'Any';
    
    var rr = getRelevant(sort, scope, semantic, s, o, maxItems);
    var relevant = rr[0];
    var relevance = rr[1];

    var xxrr = [];
    for (var x = 0; x < relevant.length; x++) {
        var xx = s.get('attention')[relevant[x]];                        
        var rr =  relevance[relevant[x]];
        xxrr.push([xx,rr]);
    }
    perItems(s, v, xxrr);
    
    /*var semanticFilter = $('<select><option>Any</option><option>Relevant</option></select>');
    semanticFilter.change(function() {
    	var v = $(this).val();
        s.set('list-semantic', v);
		updateView();
	});    
    semanticFilter.val(semantic);
	o.append(semanticFilter);
    
    var sortSelect = $('<select><option>Recent</option><option>Near</option><option>Spacetime</option></select>'); //<option>By Author</option>
	sortSelect.change(function() {
		var v = $(this).val();
        s.set('list-sort', v);
		updateView();
	});
    sortSelect.val(sort);
	o.append(sortSelect);*/
	
    /*
	var proxFilter = $('<select><option>Anywhere</option><option>Near 1km</option><option>Near 5km</option></select>');
	proxFilter.change(function() {
		requestUserSupport('Proximity Filter');
	});
	o.append(proxFilter);

	var timeFilter = $('<select><option>Anytime</option><option>Recent 1m</option><option>Recent 5m</option><option>Recent 30m</option><option>Recent 1h</option><option>Recent 24h</option></select>');
	timeFilter.change(function() {
		requestUserSupport('Time Filter');
	});
	o.append(timeFilter);
	*/
    /*
	var authorFilter = $('<select><option>Public</option><option>Mine</option><option>Others</option></select>');
	authorFilter.change(function() {
    	var v = $(this).val();
        s.set('list-scope', v);
		updateView();
	});
    authorFilter.val(scope);
	o.append(authorFilter);
    */

}

function renderBrowseList(o, v) {
    renderItems(self, o, v, 75, function(s, v, xxrr) {
        var elements = [];
        for (var i = 0; i < xxrr.length; i++) {
            var x = xxrr[i][0];
            var r = xxrr[i][1];
            elements.push(renderObjectSummary(x, function() { }, r, 1 ));
        }
        v.append(elements);
    });
    
    $('body').timeago('refresh');
}

function renderBrowseGrid(o, v) {
    renderItems(self, o, v, 75, function(s, v, xxrr) {
        var elements = [];
        for (var i = 0; i < xxrr.length; i++) {
            var x = xxrr[i][0];
            var r = xxrr[i][1];
            var o = renderObjectSummary(x, function() {
            }, r, 1);
            o.addClass('objectGridItem');
            elements.push(o);
        }
        v.append(elements);
    });

    //http://masonry.desandro.com/docs/intro.html
    /*$(function() {
        vv.imagesLoaded(function(){
            vv.masonry({
                // options
                itemSelector: '.objectView',
                columnWidth: 350
            });//.masonry('reload');
        });
    });*/

    $('body').timeago('refresh');
}

function renderBrowseSlides(o, v, slideControls) {
	var u = $('<ul/>');

    renderItems(self, o, v, 15, function(s, v, xxrr) {
        var elements = [];
        for (var i = 0; i < xxrr.length; i++) {
            var x = xxrr[i][0];
            var r = xxrr[i][1];
            var o = renderObjectSummary(x, function() {            }, r, 1);
			var l = $('<li/>');
			u.append(l);
			l.append(o);			
        }
    });


	v.append(u);
	later(function() {
		u.bxSlider({adaptiveHeight: true, responsive: true, mode: 'fade'});	
		var clientHeight = $(window).height();
		$('.bx-viewport').css('height', clientHeight + 'px' );
	});
}


function renderList(s, o, v) {
	var listRenderer = renderBrowseList;

	var submenu = $('#toggle-submenu');
	var slidesButton = $('<button style="width: 100%" title="Slides">Slides</button>');
	slidesButton.click(function() {
		listRenderer = renderBrowseSlides;
		update();
	});
	var listButton = $('<button style="width: 100%" title="List">List</button>');
	listButton.click(function() {
		listRenderer = renderBrowseList;
		update();
	});
	var gridButton = $('<button style="width: 100%" title="Grid">Grid</button>');
	gridButton.click(function() {
		listRenderer = renderBrowseGrid;
		update();
	});

	submenu.append(slidesButton);
	submenu.append(listButton);
	submenu.append(gridButton);
		
	function updateFont(s) {
		var vp = parseInt((0.15 + (s/8.0)) * 100)		
		v.css('font-size', vp + '%');
	}

	var slideControls = newDiv();
	var textsizeSlider = $('<input type="range" name="points" min="1" value="8" max="16">');
	textsizeSlider.change(function(x) {
		updateFont($(this).val());
	});
	slideControls.append(textsizeSlider);

	textsizeSlider.change();

	submenu.append(slideControls);


	function update() {
		v.html('');
		listRenderer(o, v, slideControls);
	}
	update();
}


