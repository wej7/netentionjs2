/*!
 * netention.js v1.2
 * Attentionated by @automenta and @rezn8d
 */
//Measurement types:
//<select class="ucw_selector" id="ucw_cs"><option value="Temperature">Temperature</option><option value="Length">Length</option><option value="Mass">Mass</option><option value="Speed">Speed</option><option value="Volume">Volume</option><option value="Area">Area</option><option value="Fuel consumption">Fuel consumption</option><option value="Time">Time</option><option value="Digital Storage">Digital Storage</option></select>

var localStorePrefix = 'n.';

window.authenticated = getCookie('authenticated') !== 'false';
function isAuthenticated() {
    return window.authenticated;
}
            
function loadCSS(url, med) {
    $(document.head).append(
        $("<link/>")
        .attr({
          rel:  "stylesheet",
          type: "text/css",
          href: url,
    	  media: (med !== undefined)? med : ""
        })
    );                
}

function loadJS(url) {
    $(document.head).append(
        $("<script/>")
        .attr({
          type: "text/javascript",
          src: url
        })
    );                
}

function later(f) {
    setTimeout(f, 0);
}

var stack_bottomleft = {"dir1": "right", "dir2": "up", "push": "top"};

var Self;

function netention(f) {
        		
        window.clientID = getCookie('clientID');
                
        Self = Backbone.Model.extend({
            
            clear : function() {
                this.set('tags', { });
                this.set('properties', { });    
                this.set('attention', { });    
                this.set('deleted', { });    
                this.set('replies', { });
                this.set('layer', { include: [], exclude: [] });
                this.set('focus', null );    
            },
            
            id : function() { return this.get('clientID'); },

            tag : function(t) { return this.tags()[t]; },            
            tags : function() { return this.get('tags'); },
            
            tagRoots: function() {
                var that = this;
                //this might be suboptimal
                return _.select( _.keys(this.tags()), function(tt) {
                    var t = that.tag(tt);
                    if (!t.tag)
                        return true;
                    else return (t.tag.length == 0);                    
                });
            },
            
            subtags : function(s) {
                //this might be suboptimal, use an index
                var that = this;
                return _.select( _.keys(this.tags()), function(tt) {
                    var t = that.tags()[tt];
                    if (!t.tag)
                        return false;
                    else { 
                        return (_.contains(t.tag, s));
                    }
                });                
            },
            
            isProperty : function(p) { return this.properties()[p]!=undefined; },
            
            properties : function() { return this.get('properties'); },
            //property(p)
            
            objects : function() { return this.get('attention'); },
            
            /* returns a list of object id's */
            objectsWithTag : function(t) {
                //TODO support subtags
                var r = [];
                for (var k in this.objects()) {
                    var v = this.objects()[k];
                    if (objHasTag(v, t))
                        r.push(k);
                }
                return r;
            },
            
            getObject : function(id) { return this.objects()[id]; }, //deprecated
            object : function(id) { return this.objects()[id]; }, 
            
            
            //self
            getSelf : function(clientID) { return this.objects()['Self-' + clientID]; }, 
            deleteSelf : function(clientID) {
                var os = this.get('otherSelves');
                if (os.length < 2) {
                    $.pnotify( {
                       title: 'Can not delete self: ' + clientID.substring(6) + '...' ,
                       text: 'Must have one extra self to become after deleting',
                       type: 'Error'
                    });
                    return;
                }
                var sclientID = 'Self-' + clientID;
                if (_.contains(os, sclientID)) {
                    os = _.without(os, sclientID);
                    this.set('otherSelves', os);
                    this.saveLocal();
                    
                    this.deleteObject(this.object('Self-'+ clientID));
                }
        
            },
            
            //->tag
            getTag : function(t) { return this.tags()[t]; },
            getProperty : function(p) { return this.properties()[p]; },
            
            getIncidentTags : function(userid, oneOfTags) {
                
                return objIncidentTags(this.objects(), oneOfTags, userid);
                
            },
                    
            setObject : function(o) {
                var i = o.id;
                this.objects()[i] = o;
                return o;  
            },
            
            focus : function() { 
                return this.get('focus');
            },

            layer : function() { 
                return this.get('layer');
            },            
            
            myself: function() { return this.getSelf(this.id());  },
                /*if (!o) {
                    o = objNew('Self-' + this.id(), 'Anonymous');
                    objAddTag(o, 'Human');
                    objAddTag(o, 'User');                    
                    this.setObject(o);
                }
                return o;*/
            //},
            
            become: function(target) {
                if (!target)
                    return;
                
                var s = this;
                if (typeof(target)!=="string") {
                    this.notice(target);
                }
                this.socket.emit('become', target, function(nextID) {
                    if (nextID) {
                        $.pnotify( {
                            title: 'Switched profile',
                            text: nextID
                        });
                        later(function() {
                            if (nextID.indexOf('Self-') === 0)
                                nextID = nextID.substring(5);
                            
                            s.connect(target, function() {
                                var os = self.get('otherSelves');
                                os.push('Self-' + nextID);
                                
                                self.save('otherSelves', _.unique(os));
                                
                                s.trigger('change:attention');
                                updateBrand(); //TODO use backbone Model instead of global fucntion                                
                            });                        
                        });
                    }
                    else {
                        $.pnotify( {
                            title: 'Unable to switch profile',
                            text: err + ' ' + (typeof(target)==="string" ? target : target.id),
                            type: 'Error'
                        });
                        
                    }
                });

            },
            
            
                    
            connect: function(targetID, whenConnected) {
                var suppliedObject = null;
                if (targetID) {
                    if (typeof(targetID)!=="string") {
                        suppliedObject = targetID;
                        targetID = suppliedObject.id;
                    }
                }
                
                if (!targetID) {
                    targetID = this.get('clientID');
                    var os = this.get('otherSelves');
                    if (os) {
                        if (os.length > 0) {
                            if (!_.contains(os, 'Self_' + targetID)) {
                                 targetID = os[os.length-1];
                            }
                        }
                    }
                }
                else {                
                    self.save('clientID', targetID);
                }
                                    
                var socket = this.socket
                if (!socket) {
                    socket = io.connect('/', {
                        'transports': [ 'websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling' ],
                        'reconnect': true,
                        'try multiple transports': true                    
                    });
                }
                
                    
                var that = this;

                function init() {
                    socket.emit('connect', targetID);
                    socket.emit('subscribe', 'User', true);     
                }
                
                socket.on('reconnect', function() {
                     /*$.pnotify({
                                title: 'Reconnected'

                             }); */
                     init();
                });                
                
                socket.on('setClientID', function (cid, key, otherSelves) {
                     if (cid)
                        that.set('clientID', cid.substring(5));
                     that.set('authorized', key);
                     that.set('otherSelves', _.unique(otherSelves));
                     that.saveLocal();
                     /*$.pnotify({
                                title: 'Connected',
                                text: that.myself().name + ' (' + that.get('clientID').substring(0,4) + ')'
                            });*/
                    if (whenConnected) {
                        whenConnected();
                    }
                });
                
                socket.on('notice', function(n) {
                    that.notice(n);   
                });
                
            	socket.on('addTags', function(t, p) {
                    that.addProperties(p);
                    that.addTags(t);                                  
            	});
                                
                init();
                
                this.socket = socket;
                                
                return socket;    
            },
            
            loadLocal: function() {
                var entries = 0;
                for (var k in localStorage) {
                    if (k.indexOf(localStorePrefix) == 0) {
                        var key = k.substring(localStorePrefix.length);
                        this.set(key, JSON.parse(localStorage[k]));
                        entries++;
                    }
                }
                console.log('Self loaded (' + entries + ')');                
            },
            loadSchemaJSON : function(url, f) {
                var that = this;
                
                $.getJSON(url, function(schema) {
                    that.addProperties(schema['properties']);
                    that.addTags(schema['tags']);
                    f();
                });
        
            },
                    
            saveLocal: function() {
                //DEPRECATED delete this function
                
                //console.log('SAVING');
                //localStorage.self = JSON.stringify(this.attributes);
            },

            addProperty : function(p) {
                this.properties()[p.uri] = p;
            },
            
            addTag: function(t) {
                var ty = this.tags();
                var p = this.properties();
                
                var tt = t;
                var xx = t.properties;
                /*if (ty[t.uri]!=undefined) {
                         tt = _.extend(ty[t.uri], t);
                      }*/
                ty[t.uri] = tt;
	
	        if (xx) {
                    var propertyIDs = xx;
                    if (!_.isArray(xx)) {
                        //hash-array mode
                        propertyIDs = [];
                        for (var tp in xx) {
                            var c = ty[t.uri].properties[tp];
    			    p[tp] = c;
                            propertyIDs.push(tp);
    		        }
                    }
                    
                    t.properties = propertyIDs;
	        }
            },
            
            geolocate : function(ex) {
                objSetFirstValue(this.myself(), 'spacepoint', {lat: ex[0], lon: ex[1], planet: 'Earth'} );
                
                var that = this;
                this.pub(this.myself(), function(err) {
                    $.pnotify({
                        title: 'Unable to share location.',
                        text: err,
                        type: 'Error'                        
                    });              
                    
                }, function() {
                    $.pnotify({
                        title: 'Geolocated.',
                        text: that.myself().geolocation
                    });              
                    that.saveLocal();
                    
                });    
            },
            
            addProperties : function(ap) {
                for (var k in ap) {
                	this.addProperty(ap[k]);
            	}                
            },
            
            addTags: function(at) {

                for (var k in at) {
            		this.addTag(at[k]);
            	}
                this.trigger('change:tags');
                
            },
            
            deleteObject: function(x, localOnly) {
                
                var id = x.id;
            	var that = this;
                
                function removeLocal() {
                    that.get('deleted')[id] = Date.now();
                    delete (that.objects())[id];	

                    //remove from replies
                    for (var k in that.get('replies')) {
                        that.get('replies')[k] = _.without(that.get('replies')[k], id);
                    }
                    //remove its replies
                    var replies = that.get('replies')[id];
                    if (replies)
                        for (var k = 0; k < replies.length; k++)
                            that.deleteObject(k, true);
                }
                
                if (!localOnly) {
                    var that = this;
                	this.socket.emit('delete', id, function(err) {
                            if (!err) {
                                that.saveLocal();

                                that.trigger('change:deleted');
                                that.trigger('change:attention');

                                $.pnotify({
                                    title: 'Deleted',
                                    text: id,                        
                                    addclass: "stack-bottomleft",
                                    stack: stack_bottomleft
                                });   
                                
                                removeLocal();
                            }
                            else {
                                //console.dir(err);
                                $.pnotify({
                                    title: 'Unable to delete: ' + err,
                                    text: id                        
                                });                           
                            }
                	});
                }
                else {
                    removeLocal();
                }
            	
            },
            
            getPlugins: function(withPlugins) {
                var that = this;
                this.socket.emit('getPlugins', function(p) {
                    that.unset('plugins');
                    that.set('plugins', p);
                    if (withPlugins)
                        withPlugins(p);
            	});            
            },
            
            setPlugin: function(pid, enabled, callback) {
                this.socket.emit('setPlugin', pid, enabled, callback);                    
            },
            
            getLatestObjects : function(num, onFinished) {
                var that = this;
                $.getJSON('/object/latest/' + num + '/json', function(objs) {
                	for (var k = 0; k < objs.length; k++) {
            			var x = objs[k];
            			that.notice(x);
            		}
            		onFinished();                    
                });  
            },
            
            getObjects: function(query, onObject, onFinished) {
                var that = this;
            	this.socket.emit('getObjects', query, function(objs) {
            		for (var k in objs) {
            			var x = objs[k];
            			that.notice(x);
            			if (onObject!=null)
            				onObject(x);
            		}
            		onFinished();
            	});
            },
            
            getReplies : function (uri) {
                return  this.get('replies')[uri] || [];
            },
            
            listenAll : function(b) {
                if (b) {
                    this.subscribe('*', function(f) {
                        this.notice(f);
                    });
                }
                else {
                    this.unsubscribe('*');
                }    
            },
            
            notice: function(x) {
                
            	if (!Array.isArray(x)) {
            		this.notice([x]);
            	}
                
                var attention = this.objects();
                var replies = this.get('replies');
                
                var that = this;
                
            	function n(y) {
            		if (!y)
            			return;
            		
                    if (y.removed) {
                        that.deleteObject(y, true);
                        return;
                    }
            		
                    if (y.replyTo) {
                        var p = replies[y.replyTo];
                        if (p) {
                            if (!_.contains(p, y.id))
                                p.push(y.id);
                        }
                        else {

                            replies[y.replyTo] = [ y.id ];
                        }
                    }
                    
            		if (y.id) {
            			attention[y.id] = y;
            		}
            		
                    function objTagObjectToTag(x) {
                        var p = { };
                        _.each( objValues(x, 'tagValueType'), function(v) {
                            var vv = v.split(':');
                            p[vv[0]] = { name: vv[0], type: vv[1] };
                        });
                        
                        return {
                            uri: x.name,
                            name: x.name,
                            description: objDescription(x),
                            properties: p
                        };
                    }
                    
                    if (objHasTag(y, 'Tag')) {
                        that.addTags( [ objTagObjectToTag(y) ] );
                    }
            	}
            	
                
            	for (var i = 0; i < x.length; i++)
            		n(x[i]);
                    
                this.set('attention', attention);
            	this.trigger('change:attention');
            },
            
            subscribe: function(channel, f) {
            	this.socket.emit('subscribe', channel);
            	this.socket.on('receive-'+ channel, f);	
            },
            
            unsubscribe: function(channel) {
            	this.socket.emit('unsubscribe', channel);
            	//socket.off ??
            },
            
            pub: function(object, onErr, onSuccess) {
                this.socket.emit('pub', object, function(err) {
                    if (onErr)
                        onErr(object);
                    $.pnotify({title: 'Error saving:', text: err, type:'error'});
                }, onSuccess);
            },
            
            //THIS NEEDS UPDATED
            getClientInterests: function(f) {
            	this.socket.emit('getClientInterests', f);
            },
            
            getTagCount : function(onlySelf, predicate) {
                                
                var tagCount = { };
                var aa = this.get('attention');                
                var myID = this.id();
                
                for (var ai in aa) {
                    var oi = aa[ai];
                    
                    if (predicate)
                        if (!predicate(oi))
                            continue;
                    
                    if (onlySelf)
                        if (oi.author!=myID)
                            continue;
                    
                    //var t = objTags(oi);
                    var ts = objTagStrength(oi);
                    for (var i in ts) {
                        if (!tagCount[i])
                            tagCount[i] = 0;
                        tagCount[i] = tagCount[i] + ts[i]; //TODO add the normalized tag strength
                    }
                }
                return tagCount;
            },
            
            getServerAttention : function(withResults) {
                $.getJSON('/attention', function(attention) {
                    withResults(attention);
                }); 
            },
            save: function(key, value) {
                self.set(key, value);
                var k = localStorePrefix + key;
                localStorage[k] = JSON.stringify(value);
            }

            
        });
        

	console.log('Scripts loaded');
		
        var s = new Self();
        
        s.clear();
        s.loadLocal();
                 
        //console.log('loaded clientID: ' + s.get('clientID'));
        var oldCID = s.get('clientID');
        var nextCID = window.clientID;
        if ((nextCID === '') || (nextCID === undefined))
            nextCID = oldCID;
        if ((nextCID === '') || (nextCID === undefined))
            nextCID = uuid();
        
        s.set('clientID', nextCID);
        s.saveLocal();
        //console.log('saved clientID: ' + s.get('clientID'));
        
        s.connect(function() { });
        f(s);
		
	
}


//apparently is faster than $('<div/>');
function newDiv() {
    return $(document.createElement('div'));
}

function newPopup(title,p) {
    var d = newDiv();
    d.attr('title', title);
    
    $('body').append(d);
    d.dialog(p);
    return d;    
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}