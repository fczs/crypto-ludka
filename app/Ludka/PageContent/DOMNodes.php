<?php

namespace Ludka\PageContent;

class DOMNodes
{
    /**
     * @var \DOMDocument
     */
    private $dom;

    public function get(): \DOMDocument
    {
        return $this->dom;
    }

    /**
     * @param string $content
     * @return DOMNodes
     */
    public function loadContent(string $content): DOMNodes
    {
        $this->dom = new \DOMDocument();
        $this->dom->loadHTML($content);
        return $this;
    }

    /**
     * @param string $query
     * @return \DOMNodeList
     */
    public function fetch(string $query): \DOMNodeList
    {
        $xpath = new \DOMXPath($this->dom);
        return $xpath->query($query);
    }
}