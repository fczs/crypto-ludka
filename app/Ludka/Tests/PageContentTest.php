<?php

namespace Ludka\Tests;

use Ludka\PageContent\PageContent;

class PageContentTest
{
    public function getContent(string $url, string $node): \DOMNodeList
    {
        return (new PageContent())->setUrl($url)->getContentNodes($node);
    }
}
