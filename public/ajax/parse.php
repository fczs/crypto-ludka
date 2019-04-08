<?php

$ROOT = dirname(dirname(__DIR__));

require $ROOT . '/app/autoload.php';

use \Ludka\Utils\Config;

$pinnacle = Config::get('pinnacle.CAT');
$teamNames = Config::get('pinnacle.TEAMS');
$fileLinks = $ROOT . '/storage/pinnacle/links.txt';
$result = [];

if (!file_exists($fileLinks) || time() - filemtime($fileLinks) > 3600) {
    // create empty file to avoid multiple requests to the pinnacle pages
    file_put_contents($fileLinks, '');

    $matchLinks = [];

    foreach ($pinnacle as $linkType => $link) {
        $content = getTrimmedContent($link);

        preg_match('/<div\sclass="list-group">(.+)<\!\-\-\sHERE\sWILL/', $content, $block);
        preg_match_all('/<a\shref="([^"]+)/', $block[1], $uris);
        preg_match_all('/<span\sclass="team\s(fav)?">([^<]+)/', $block[1], $teams);
        foreach ($uris[1] as $key => $uri) {
            $team1 = str_replace('&#160;', '', trim($teams[2][$key * 2 + 1]));
            $team2 = str_replace('&#160;', '', trim($teams[2][$key * 2]));
            $matchLinks[$team1 . '-' . $team2] = $linkType . '*' . 'https://www.pinnacle.com' . $uri;
        }
    }

    file_put_contents($fileLinks, json_encode($matchLinks));
}

foreach ($_POST as $event) {
    $id = $event['id'];
    $type = $event['type'];
    $team1 = $event['team1'];
    $team2 = $event['team2'];
    $spread1 = str_replace('+', '', $event['spread1']);
    $spread2 = str_replace('+', '', $event['spread2']);
    $total = $event['total'];

    if (array_key_exists($team1, $teamNames)) {
        $team1 = $teamNames[$team1];
    }

    if (array_key_exists($team2, $teamNames)) {
        $team2 = $teamNames[$team2];
    }

    $fileMatchData = sprintf('%s/storage/pinnacle/data_%s.txt', $ROOT, $id);


    $matchLinks = json_decode(file_get_contents($fileLinks), true);
    $matchUriStr = $matchLinks[$team1 . '-' . $team2];

    if (empty($matchUriStr)) {
        $matchUriStr = $matchLinks[$team2 . '-' . $team1];
    }

    $matchUriArr = explode('*', $matchUriStr);
    $linkType = $matchUriArr[0];
    $matchUri = $matchUriArr[1];

    if (!empty($matchUri)) {
        $matchData = [];
        //$matchData = json_decode(file_get_contents($fileMatchData), true);

        $content = getContents($matchUri)['content'];
        $dom = new DOMDocument();
        $dom->loadHTML($content);

        $xpath = new DOMXPath($dom);
        $nodes = $xpath->query('//div[@class="panel panel-primary"]');

        $handicap = '';
        $totals = [];

        foreach ($nodes as $key => $node) {
            $nodeVal = preg_replace('/\s+/', ' ', trim($node->nodeValue));
            $nodeVal = preg_replace('/[^A-Za-z0-9\-\s\.\(\)\'\&]/', '', $nodeVal);

            if ($key === 0) {
                $teams = str_replace('Money Line FT ', '', $nodeVal);
                preg_match_all('/[^\d\.]+/', $teams, $team);

                // TODO: solve issue with digits in the name of the team
                //if (preg_match('/[0-9]/', $team1) !== 1) {
                if (strpos($team1, $team[0][0]) !== false) {
                    $team1 = trim($team[0][0]);
                }
                if (strpos($team1, $team[0][2]) !== false) {
                    $team1 = trim($team[0][2]);
                }
                //}

                //if (preg_match('/[0-9]/', $team2) !== 1) {
                if (strpos($team2, $team[0][0]) !== false) {
                    $team2 = trim($team[0][0]);
                }
                if (strpos($team2, $team[0][2]) !== false) {
                    $team2 = trim($team[0][2]);
                }
                //}
            }

            if ($type === 'nhl') {
                if (substr($nodeVal, 0, 13) === 'Money Line FT') {
                    $handicap = $nodeVal;
                }
            } else {
                if (substr($nodeVal, 0, 11) === 'Handicap FT') {
                    $handicap = str_replace('Handicap FT ', '', $nodeVal);
                }
            }

            if (substr($nodeVal, 0, 9) === 'Totals FT') {
                $strTotals = str_replace('Totals FT ', '', $nodeVal);
                preg_match_all('/OVER\s([\d\.]+\s[\d\.]+)\sUNDER\s([\d\.]+\s[\d\.]+)/', $strTotals, $tmpTotals);
                foreach ($tmpTotals[1] as $over) {
                    $o = explode(' ', $over);
                    $totals['over'][$o[0]] = $o[1];
                }
                foreach ($tmpTotals[2] as $under) {
                    $u = explode(' ', $under);
                    $totals['under'][$u[0]] = $u[1];
                }
            }
        }

        $matchData['handicap'] = $handicap;
        $matchData['totals'] = $totals;

        $matchData['id'] = $id;
        $matchData['uri'] = $matchUri;

        $matchData['type'] = $type;
        $matchData['linkType'] = $linkType;

        if (array_key_exists($linkType, Config::get('pinnacle.MARGIN'))) {
            $matchData['margin'] = Config::get('pinnacle.MARGIN')[$linkType];
        } elseif ($type == 'soccer') {
            $matchData['margin'] = Config::get('pinnacle.MARGIN_SOCCER');
        } else {
            $matchData['margin'] = Config::get('pinnacle.MARGIN_DEFAULT');
        }

        if (!empty($spread1) && !empty($spread2)) {

            if ($type === 'nhl') {
                $matchData['spread1'] = substr($handicap, strpos($handicap, $team1) + strlen($team1), 5);
                $matchData['spread2'] = substr($handicap, strpos($handicap, $team2) + strlen($team2), 5);
            } else {
                $matchData['sp1'] = $sp1 = $team1 . ' ' . $spread1 . ' ';
                $matchData['sp2'] = $sp2 = $team2 . ' ' . $spread2 . ' ';

                if (strpos($handicap, $sp1) !== false) {
                    $matchData['spread1'] = substr($handicap, strpos($handicap, $sp1) + strlen($sp1), 5);
                }
                if (strpos($handicap, $sp2) !== false) {
                    $matchData['spread2'] = substr($handicap, strpos($handicap, $sp2) + strlen($sp2), 5);
                }
            }
        }

        if (!empty($total)) {
            $matchData['totalOver'] = $totals['over'][$total];
            $matchData['totalUnder'] = $totals['under'][$total];

            if (empty($matchData['totalOver']) && $total < key($totals['over'])) {
                $firstOver = floatval(reset($totals['over']));
                $multiplier = (key($totals['over']) - floatval($total)) * 2;
                $factorsDiff = floatval(next($totals['over'])) - floatval(reset($totals['over'])) - 0.005;
                $matchData['totalOver'] = number_format($firstOver - $factorsDiff * $multiplier, 3, '.', '');
            }

            end($matchData['totalUnder']);
            if (empty($matchData['totalUnder']) && $total > key($totals['under'])) {
                $lastUnder = floatval(end($totals['under']));
                $multiplier = (floatval($total) - key($totals['under'])) * 2;
                $factorsDiff =  prev($totals['under']) - end($totals['under']) - 0.005;
                $matchData['totalUnder'] = number_format($lastUnder - $factorsDiff * $multiplier, 3, '.', '');
            }
        }

        //file_put_contents($fileMatchData, json_encode($matchData));
//        if ($team2 == 'Watford')
//            file_put_contents($fileMatchData, print_r($matchData, true));

        $result[] = json_encode($matchData);
    }

    //$result[] = file_get_contents($fileMatchData);
}

echo json_encode($result);
exit;

function getTrimmedContent($link)
{
    return preg_replace('/\s+/', ' ', trim(getContents($link)['content']));
}

function getContents($url)
{
    global $ROOT;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_POST => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
        CURLOPT_COOKIEFILE => $ROOT . "/storage/pinnacle/cookie.txt",
        CURLOPT_COOKIEJAR => $ROOT . "/storage/pinnacle/cookie.txt",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_ENCODING => '',
        CURLOPT_AUTOREFERER => true,
        CURLOPT_CONNECTTIMEOUT => 120,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_MAXREDIRS => 10
    ]);
    $content = curl_exec($ch);
    $err = curl_errno($ch);
    $errmsg = curl_error($ch);
    $header = curl_getinfo($ch);
    curl_close($ch);

    $header['errno'] = $err;
    $header['errmsg'] = $errmsg;
    $header['content'] = $content;

    return $header;
}