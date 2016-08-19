<?php
class Sns_Toronto_Block_Adminhtml_System_Config_Form_Field_EditorCss extends Mage_Adminhtml_Block_System_Config_Form_Field
{
    protected function _getElementHtml(Varien_Data_Form_Element_Abstract $element)
    {
        $elementId = $element->getHtmlId();
        $html = parent::_getElementHtml($element);
        
        $html .= $element->getAfterElementHtml();

        $html .= '
<script type="text/javascript">
	window.onload=function(){
		editAreaLoader.init({
			id: "'.$elementId.'"
			,start_highlight: true
			,font_size: "8"
			,font_family: "verdana, monospace"
			,allow_resize: "both"
			,allow_toggle: false
			,syntax: "css"
			,min_width: 280
			,browsers: "all"
			,is_editable: true
			,change_callback: "editorChange"
		});
	};
	function editorChange (id, content) {
		document.getElementById("'.$elementId.'").value = editAreaLoader.getValue("'.$elementId.'");
	}
</script>
        ';

		
        return $html;
    }
}