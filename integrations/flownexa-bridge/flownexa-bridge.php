<?php
/**
 * Plugin Name: FlowNexa Bridge
 * Description: Connects WordPress content and identified WooCommerce abandoned carts to FlowNexa.
 * Version: 0.1.0
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) { exit; }
final class FlowNexa_Bridge {
 const OPTION='flownexa_bridge'; const TABLE='flownexa_carts';
 static function boot() {
  add_action('admin_menu', [__CLASS__,'menu']);
  add_action('admin_init', [__CLASS__,'settings']);
  add_action('rest_api_init', [__CLASS__,'routes']);
  add_action('woocommerce_checkout_update_order_review', [__CLASS__,'capture']);
  add_action('woocommerce_store_api_cart_update_customer_from_request', [__CLASS__,'capture_blocks'],10,2);
  add_action('woocommerce_store_api_checkout_update_customer_from_request', [__CLASS__,'capture_blocks'],10,2);
  add_action('woocommerce_checkout_order_processed', [__CLASS__,'completed'],10,1);
  add_action('woocommerce_store_api_checkout_order_processed', [__CLASS__,'completed'],10,1);
  add_action('flownexa_bridge_tick', [__CLASS__,'tick']);
  add_action('transition_post_status', [__CLASS__,'published'],10,3);
  add_action('template_redirect', [__CLASS__,'recover']);
 }
 static function install() {
  if(!function_exists('openssl_encrypt')||!in_array('aes-256-gcm',openssl_get_cipher_methods(),true))wp_die('FlowNexa Bridge requer OpenSSL com AES-256-GCM.');
  global $wpdb; require_once ABSPATH.'wp-admin/includes/upgrade.php';
  dbDelta("CREATE TABLE {$wpdb->prefix}".self::TABLE." (id varchar(64) NOT NULL, email_hash varchar(64) NOT NULL, payload longtext NOT NULL, updated_at bigint NOT NULL, expires_at bigint NOT NULL, completed tinyint NOT NULL DEFAULT 0, notified tinyint NOT NULL DEFAULT 0, PRIMARY KEY (id), KEY email_hash (email_hash)) {$wpdb->get_charset_collate()};");
  if (!wp_next_scheduled('flownexa_bridge_tick')) wp_schedule_event(time()+300,'hourly','flownexa_bridge_tick');
 }
 static function deactivate(){wp_clear_scheduled_hook('flownexa_bridge_tick');}
 static function options(){return get_option(self::OPTION,[]);}
 static function menu(){add_options_page('FlowNexa Bridge','FlowNexa Bridge','manage_options','flownexa-bridge',[__CLASS__,'page']);}
 static function settings(){register_setting('flownexa_bridge_group',self::OPTION,['sanitize_callback'=>function($v){
  $old=self::options();$url=esc_url_raw($v['url']??'');
  if ($url && (!wp_http_validate_url($url)||parse_url($url,PHP_URL_SCHEME)!=='https')) {add_settings_error(self::OPTION,'url','Informe um webhook público HTTPS.');return $old;}
  $key=trim($v['key']??'');if (!$key) $key=$old['key']??bin2hex(random_bytes(32));
  if (!preg_match('/^[A-Za-z0-9_-]{32,128}$/',$key)) {add_settings_error(self::OPTION,'key','Use uma chave de 32 a 128 letras/números.');return $old;}
  return ['url'=>$url,'key'=>$key];
 }]);}
 static function page(){
  if(!current_user_can('manage_options'))return;$o=self::options();
  echo '<div class="wrap"><h1>FlowNexa Bridge</h1><p>Cadastre o webhook da conexão e copie a mesma chave para o FlowNexa. O carrinho só é registrado após o cliente informar o e-mail no checkout clássico ou o Checkout Blocks sincronizar os dados do cliente. Os dados expiram em 7 dias.</p><form method="post" action="options.php">';
  settings_fields('flownexa_bridge_group');
  echo '<p><label>Webhook HTTPS <input type="url" size="80" name="flownexa_bridge[url]" value="'.esc_attr($o['url']??'').'"></label></p><p><label>Chave compartilhada <input type="password" autocomplete="new-password" name="flownexa_bridge[key]" placeholder="Deixe vazio para manter ou gerar"></label></p>';
  submit_button();echo '</form>';
  if(!empty($o['key']))echo '<details><summary>Mostrar chave para cadastrar no FlowNexa</summary><code>'.esc_html($o['key']).'</code></details>';
  echo '<p>Novidades só são enviadas a contatos elegíveis com autorização registrada no FlowNexa. Inclua a captura de carrinhos no aviso de privacidade da loja.</p></div>';
 }
 static function authorized($r){$key=self::options()['key']??'';return strlen($key)>=32&&hash_equals($key,(string)$r->get_header('X-FlowNexa-Key'));}
 static function routes(){
  register_rest_route('flownexa/v1','/capabilities',['methods'=>'GET','permission_callback'=>[__CLASS__,'authorized'],'callback'=>fn()=>['abandoned_carts'=>class_exists('WooCommerce'),'capture'=>'classic_and_blocks','version'=>'0.1.0']]);
  register_rest_route('flownexa/v1','/carts',['methods'=>'GET','permission_callback'=>[__CLASS__,'authorized'],'callback'=>[__CLASS__,'carts']]);
 }
 static function seal($value){$iv=random_bytes(12);$tag='';$cipher=openssl_encrypt(wp_json_encode($value),'aes-256-gcm',hash('sha256',wp_salt('auth'),true),OPENSSL_RAW_DATA,$iv,$tag);return base64_encode($iv.$tag.$cipher);}
 static function open($value){$raw=base64_decode($value,true);if(!$raw||strlen($raw)<29)return null;$plain=openssl_decrypt(substr($raw,28),'aes-256-gcm',hash('sha256',wp_salt('auth'),true),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16));return $plain?json_decode($plain,true):null;}
 static function capture($posted){parse_str($posted,$fields);self::capture_email($fields['billing_email']??'');}
 static function capture_blocks($customer,$request){self::capture_email($customer->get_billing_email());}
 static function capture_email($email){
  if(!function_exists('WC')||!WC()->session||!WC()->cart||WC()->cart->is_empty()||empty(self::options()['key']))return;
  $email=sanitize_email($email);if(!is_email($email))return;
  global $wpdb;$id=hash_hmac('sha256',WC()->session->get_customer_id(),wp_salt('nonce'));$prior=$wpdb->get_row($wpdb->prepare("SELECT payload FROM {$wpdb->prefix}".self::TABLE." WHERE id=%s",$id),ARRAY_A);$old=$prior?self::open($prior['payload']):null;
  $items=[];foreach(WC()->cart->get_cart() as $item)$items[]=['product_id'=>(int)$item['product_id'],'variation_id'=>(int)$item['variation_id'],'variation'=>$item['variation'],'quantity'=>min(100,(int)$item['quantity'])];
  $token=($old&&($old['email']??'')===strtolower($email))?$old['token']:bin2hex(random_bytes(32));$data=['email'=>strtolower($email),'items'=>$items,'token'=>$token];
  $wpdb->replace($wpdb->prefix.self::TABLE,['id'=>$id,'email_hash'=>hash_hmac('sha256',strtolower($email),wp_salt('auth')),'payload'=>self::seal($data),'updated_at'=>time(),'expires_at'=>time()+7*DAY_IN_SECONDS,'completed'=>0,'notified'=>0]);
  WC()->session->set('flownexa_cart_id',$id);
 }
 static function completed($order){
  if(!function_exists('WC')||!WC()->session)return;global $wpdb;$id=WC()->session->get('flownexa_cart_id');if($id)$wpdb->update($wpdb->prefix.self::TABLE,['completed'=>1],['id'=>$id]);
 }
 static function carts($r){
  $email=sanitize_email($r->get_param('email'));if(!is_email($email))return new WP_Error('invalid_email','E-mail inválido',['status'=>400]);global $wpdb;
  $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}".self::TABLE." WHERE email_hash=%s AND completed=0 AND updated_at<%d AND expires_at>%d LIMIT 20",hash_hmac('sha256',strtolower($email),wp_salt('auth')),time()-3600,time()),ARRAY_A);$out=[];
  foreach($rows as $row){$data=self::open($row['payload']);if(!$data)continue;$out[]=['id'=>$row['id'],'email'=>$data['email'],'recovery_url'=>add_query_arg(['flownexa_cart'=>$row['id'],'flownexa_key'=>$data['token']],home_url('/'))];}
  return ['carts'=>$out];
 }
 static function deliver($event,$data,$event_id){
  $o=self::options();if(empty($o['url'])||empty($o['key']))return false;
  $body=wp_json_encode(['id'=>$event_id,'event'=>$event,'timestamp'=>(int)round(microtime(true)*1000),'data'=>$data]);
  $r=wp_safe_remote_post($o['url'],['timeout'=>10,'redirection'=>0,'headers'=>['Content-Type'=>'application/json','X-FlowNexa-Signature'=>hash_hmac('sha256',$body,$o['key'])],'body'=>$body]);
  return !is_wp_error($r)&&wp_remote_retrieve_response_code($r)>=200&&wp_remote_retrieve_response_code($r)<300;
 }
 static function tick(){
  global $wpdb;$table=$wpdb->prefix.self::TABLE;
  $rows=$wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE completed=0 AND notified=0 AND updated_at<%d AND expires_at>%d LIMIT 20",time()-3600,time()),ARRAY_A);
  foreach($rows as $row){$data=self::open($row['payload']);if(!$data)continue;if(self::deliver('cart.abandoned',['id'=>$row['id'],'email'=>$data['email']],$row['id'].':'.$row['updated_at']))$wpdb->update($table,['notified'=>1],['id'=>$row['id']]);}
  $wpdb->query($wpdb->prepare("DELETE FROM $table WHERE expires_at<%d",time()));
 }
 static function recover(){
  if(empty($_GET['flownexa_cart'])||empty($_GET['flownexa_key'])||!function_exists('WC'))return;
  global $wpdb;$id=sanitize_text_field(wp_unslash($_GET['flownexa_cart']));$token=sanitize_text_field(wp_unslash($_GET['flownexa_key']));
  $row=$wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}".self::TABLE." WHERE id=%s AND completed=0 AND expires_at>%d",$id,time()),ARRAY_A);$data=$row?self::open($row['payload']):null;
  if(!$data||!hash_equals($data['token'],$token)){wp_die('Este link de carrinho expirou.', 'FlowNexa', ['response'=>410]);}
  if(!WC()->cart)wc_load_cart();WC()->cart->empty_cart();
  foreach($data['items'] as $item)WC()->cart->add_to_cart($item['product_id'],$item['quantity'],$item['variation_id'],$item['variation']);
  WC()->session->set('flownexa_cart_id',$id);nocache_headers();header('Referrer-Policy: no-referrer');wp_safe_redirect(wc_get_checkout_url());exit;
 }
 static function published($new,$old,$post){if($new==='publish'&&$old!=='publish'&&$post->post_type==='post')self::deliver('content.published',['id'=>$post->ID,'name'=>$post->post_title,'url'=>get_permalink($post)],'post:'.$post->ID);}
}
register_activation_hook(__FILE__,['FlowNexa_Bridge','install']);
register_deactivation_hook(__FILE__,['FlowNexa_Bridge','deactivate']);
FlowNexa_Bridge::boot();
