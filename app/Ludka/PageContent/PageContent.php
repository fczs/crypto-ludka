<?php

namespace Ludka\PageContent;

use Ludka\Http\CurlRequest;

class PageContent
{
    /**
     * @var string
     */
    private $url;

    public function setUrl(string $url): PageContent
    {
        $this->url = $url;
        return $this;
    }

    public function getContentNodes(string $node): \DOMNodeList
    {
        $dom = new DOMNodes();
        $response = (new CurlRequest())->get($this->url);
        return $dom->loadContent($response['content'])->fetch($node);
    }
}
