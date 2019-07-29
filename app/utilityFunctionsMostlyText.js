const Autolinker = require('autolinker');
var sanitize = require('mongo-sanitize');
var sanitizeHtml = require('sanitize-html');
var got = require('got');
const urlp = require('url');
const metascraper = require('metascraper')([
    require('metascraper-description')(),
    require('metascraper-image')(),
    require('metascraper-title')(),
    require('metascraper-url')()
  ])

module.exports = {
    // Parses new post and new comment content. Input: a text string. Output: a parsed text string.
    parseText: async function(rawText, cwsEnabled = false, mentionsEnabled = true, hashtagsEnabled = true, urlsEnabled = true, youtubeEnabled = false) {
        console.log("Parsing content")
        let splitContent = rawText.split('</p>');
        let parsedContent = [];
        var mentionRegex = /(^|[^@\w])@([\w-]{1,30})[\b-]*/g
        var mentionReplace = '$1<a href="/$2">@$2</a>';
        var hashtagRegex = /(^|>|\n|\ |\t)#(\w{1,60})\b/g
        var hashtagReplace = '$1<a href="/tag/$2">#$2</a>';
        splitContent.forEach(function(line) {
            line += '</p>'
            if (line.replace(/<[^>]*>/g, "") != "") { // Filters out lines which are just HTML tags
                if (urlsEnabled) {
                    line = Autolinker.link(line);
                }
                if (mentionsEnabled) {
                    line = line.replace(mentionRegex, mentionReplace)
                }
                if (hashtagsEnabled) {
                    line = line.replace(hashtagRegex, hashtagReplace);
                }
                parsedContent.push(line);
            }
        })
        parsedContent = parsedContent.join('');
        parsedContent = sanitize(parsedContent);

        parsedContent = this.sanitizeHtmlForSweet(parsedContent);

        if (!cwsEnabled) {
            let contentWordCount = wordCount(parsedContent);
            if (contentWordCount > 160) {
                parsedContent = '<div class="abbreviated-content">' + parsedContent + '</div><button type="button" class="button grey-button show-more" data-state="contracted">Show more</button>';
            }
        }

        let mentionsArray = Array.from(new Set(rawText.replace(/<[^>]*>/g, " ").match(mentionRegex)))
        let tagsArray = Array.from(new Set(rawText.replace(/<[^>]*>/g, " ").match(hashtagRegex)))
        let trimmedMentions = []
        let trimmedTags = []
        if (mentionsArray) {
            mentionsArray.forEach((el) => {
                trimmedMentions.push(el.replace(/(@|\s)*/i, ''));
            })
        }
        if (tagsArray) {
            tagsArray.forEach((el) => {
                trimmedTags.push(el.replace(/(#|\s)*/i, ''));
            })
        }

        if (youtubeEnabled) {
            console.log("Embedding!")
            var embeds = [];
            var embedsAllowed = 1; //harsh, i know
            var embedsAdded = 0;
            var linkFindingRegex = /<p><a href="(.*?)" target="_blank">(.*?)<\/a><\/p>/g //matches all links with a line to themselves.
            //taken from https://stackoverflow.com/questions/19377262/regex-for-youtube-url
            var youtubeUrlFindingRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
            //taken from https://github.com/regexhq/vimeo-regex/blob/master/index.js
            var vimeoUrlFindingRegex = /^(http|https)?:\/\/(www\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|)(\d+)(?:|\/\?)$/

            if (parsedContent.search(linkFindingRegex) != -1) {
                var r = linkFindingRegex.exec(parsedContent);
                var parsedContentNoEmbeds = parsedContent.slice(); //need a copy of parsedContent that we can modify without throwing off lastIndex in RegExp.exec
                while (r && embedsAdded < embedsAllowed) {
                    if (r[1].search(youtubeUrlFindingRegex) != -1 && r[2].search(youtubeUrlFindingRegex) != -1) {
                        var parsedVUrl = youtubeUrlFindingRegex.exec(r[1])
                        var videoid = parsedVUrl[5];
                        const { body: html, url } = await got(parsedVUrl[0])
                        const metadata = await metascraper({ html, url })
                        var embed = {
                            type: 'video',
                            embedUrl: "https://www.youtube.com/embed/" + videoid + "?autoplay=1", //won't actually autoplay until link preview is clicked
                            linkUrl: parsedVUrl[0],
                            image: metadata.image,
                            title: metadata.title,
                            description: metadata.description,
                            domain: "youtube.com",
                            position: r.index //relative to the start of the final version of parsedContent (the version with all the embed-causing stuff scraped out)
                        }
                        embeds.push(embed) // 'embed' no longer looks like a word
                        parsedContentNoEmbeds = parsedContentNoEmbeds.substring(0,r.index) +  parsedContentNoEmbeds.substring(linkFindingRegex.lastIndex,parsedContentNoEmbeds.length);
                        ++embedsAdded;
                    }else if(r[1].search(vimeoUrlFindingRegex) != -1 && (r[2].substring(0,4)=="http" ? r[2] : "https://"+r[2]).search(vimeoUrlFindingRegex) != -1){
                        var parsedVUrl = vimeoUrlFindingRegex.exec(r[1]);
                        var videoid = parsedVUrl[4];

                        const { body: html, url } = await got(parsedVUrl[0])
                        const metadata = await metascraper({ html, url })

                        var embed = {
                            type: 'video',
                            embedUrl: 'https://player.vimeo.com/video/' + videoid + "?autoplay=1",
                            linkUrl: parsedVUrl[0],
                            image: metadata.image,
                            title: metadata.title,
                            description: metadata.description,
                            domain: "vimeo.com",
                            position: r.index //relative to start of parsedContent
                        }
                        embeds.push(embed)
                        parsedContentNoEmbeds = parsedContentNoEmbeds.substring(0,r.index) +  parsedContentNoEmbeds.substring(linkFindingRegex.lastIndex,parsedContentNoEmbeds.length);
                        ++embedsAdded;
                    }
                    r = linkFindingRegex.exec(parsedContent);
                }
                parsedContent = parsedContentNoEmbeds
            }
        }

        return {
            text: parsedContent,
            mentions: trimmedMentions,
            tags: trimmedTags,
            embeds: embeds
        };
    },
    isEven: function(n) {
        return n % 2 == 0;
    },
    isOdd: function(n) {
        return Math.abs(n % 2) == 1;
    },
    slugify: function(string) {
        const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœṕŕßśșțùúüûǘẃẍÿź·/_,:;'
        const b = 'aaaaaaaaceeeeghiiiimnnnoooooprssstuuuuuwxyz------'
        const p = new RegExp(a.split('').join('|'), 'g')

        return string.toString().toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
            .replace(/&/g, '-and-') // Replace & with 'and'
            .replace(/[^\w\-]+/g, '') // Remove all non-word characters
            .replace(/\-\-+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, '') // Trim - from end of text
    },
    sanitizeHtmlForSweet: function(parsedContent) {
        return sanitizeHtml(parsedContent, {
            allowedTags: ['blockquote', 'ul', 'li', 'em', 'i', 'b', 'strong', 'a', 'p', 'br'],
            allowedAttributes: {
                'a': ['href','target']
            },
            transformTags: {
                'a': function(tagName, attribs) {
                    //if a link is not explicitly relative due to an initial / (like mention and hashtag links are) and doesn't already include the // that makes it non-relative
                    if (attribs.href.substring(0,1) != "/" && !attribs.href.includes('//')) {
                        //make the link explicitly non-relative
                        attribs.href = "//" + attribs.href;
                    }
                    attribs.target = "_blank";
                    return {
                        tagName: 'a',
                        attribs: attribs
                    };
                }
            }
        });
    },
    //takes a post or comment documents and returns its parsedText with the embed html placed at its position according to the embeds array. never actually tested with more than one embed.
    mixInEmbeds: function(post) { //actually, can also be a comment
        if (post.embeds && post.embeds.length > 0) {
            var index = 0;
            var withEmbeds = "";
            if (post.embeds.length == 1 && typeof post.embeds[0].position == "undefined") { //old, positionless single embed scheme
                return post.parsedContent + post.cachedHTML.embedsHTML[0];
            } else {
                for (var i = 0; i < post.embeds.length; i++) { //new, positioned embed scheme
                    withEmbeds += post.parsedContent.substring(index, post.embeds[i].position);
                    withEmbeds += post.cachedHTML.embedsHTML[i];
                    index = post.embeds[i].position;
                }
                withEmbeds += post.parsedContent.substring(post.embeds[post.embeds.length - 1].position, post.parsedContent.length);
                return withEmbeds;
            }
        }
    }
}

function wordCount(str) {
    return str.split(' ')
        .filter(function(n) {
            return n != ''
        })
        .length;
}
