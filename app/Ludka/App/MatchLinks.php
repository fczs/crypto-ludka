<?php

namespace Ludka\App;

use Ludka\PageContent\PageContent;
use Ludka\Utils\Config;

class MatchLinks
{
    /**
     * @var string
     */
    private $fLinks;

    public function __construct()
    {
        $this->fLinks = Config::get('files.LINKS');
    }

    /**
     * @return false|int
     */
    public function set()
    {
        if (!file_exists($this->fLinks) || time() - filemtime($this->fLinks) > Config::get('pinnacle.REQUEST_TIMEOUT')) {
            // create empty file to avoid multiple requests to the pinnacle pages
            file_put_contents($this->fLinks, '');

            $matchLinks = [];

            foreach (Config::get('pinnacle.CAT') as $linkType => $link) {
                $page = new PageContent();
                $content = $page->setUrl($link)->getContentNodes('//a[@class="list-group-item list-group-item-light col-xs-12 ajax-me"]');


            }

            //return file_put_contents($this->fLinks, json_encode($matchLinks));
        }

        //return filesize($this->fLinks);
    }

    /**
     * @return null|array
     */
    public function get()
    {
        return file_exists($this->fLinks) ? json_decode(file_get_contents($this->fLinks), true) : null;
    }
}
