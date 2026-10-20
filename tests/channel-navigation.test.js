import test from 'node:test';
import assert from 'node:assert/strict';
import {appPage} from '../src/app-ui.js';
import {appClient} from '../src/app-client.js';

const html=appPage();
test('each platform has one clickable sidebar tab and a separate dashboard area',()=>{
  for(const [channel,panel] of [['instagram','instagram-channel'],['facebook','facebook'],['tiktok','tiktok-channel'],['youtube','youtube-channel']]){
    assert.equal((html.match(new RegExp(`id="channel-${channel}"`,'g'))||[]).length,1);
    assert.match(html,new RegExp(`id="channel-${channel}"[^>]*role="tab"|id="channel-${channel}" role="tab"`));
    assert.equal((html.match(new RegExp(`id="${panel}"`,'g'))||[]).length,1);
    assert.match(html,new RegExp(`aria-controls="${panel}"`));
  }
  assert.ok(html.indexOf('id="instagram-channel"')<html.indexOf('id="facebook"'));
  assert.match(html,/id="facebook-unavailable"/);
  assert.match(html,/id="facebook"[^>]*role="tabpanel"/);
  assert.match(html,/id="facebook-nav"/);
});

test('Instagram editor stays isolated and Facebook scripts are shipped with dashboard',()=>{
  assert.match(html,/id="instagram-channel"[\s\S]*id="saved-automations"/);
  assert.match(html,/id="facebook"[\s\S]*id="tiktok-channel"/);
  assert.match(html,/id="tiktok-channel"[\s\S]*id="youtube-channel"/);
  assert.match(html,/id="facebook"[^>]*hidden/);
  const compiled=appClient();
  assert.doesNotThrow(()=>new Function(compiled));
  assert.match(compiled,/\/api\/facebook\/accounts/);
  assert.match(compiled,/\/api\/facebook\/flows/);
  assert.match(compiled,/\/api\/facebook\/executions/);
});

test('inactive TikTok and YouTube dashboards do not pretend to connect accounts',()=>{
  for(const channel of ['tiktok','youtube']){
    const panel=html.slice(html.indexOf(`id="${channel}-channel"`),html.indexOf('</section>',html.indexOf(`id="${channel}-channel"`)));
    assert.match(panel,/Contas/);
    assert.match(panel,/Automações/);
    assert.match(panel,/Atividade/);
    assert.match(panel,/Conexão ainda indisponível/);
    assert.match(panel,/button disabled/);
  }
});
